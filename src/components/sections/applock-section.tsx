'use client'

/**
 * App Lock — section + lock screen + auto-lock hook
 *
 * Local-only device-UI protection. The server has NO knowledge of the PIN.
 *
 * Setup: user picks a 4-6 digit PIN → we derive a PBKDF2-SHA256 key (100k
 * iterations) with a random 16-byte salt, then AES-GCM-encrypt a known marker
 * string. The encrypted marker (ciphertext + salt + iv) + pinLength +
 * autoLockDelay + biometricEnabled live in localStorage under
 * `studenttemp_applock_data`. The boolean enabled flag also lives under
 * `studenttemp_applock` (mirrored by the Zustand store).
 *
 * Unlock: user re-enters PIN → re-derive key → try AES-GCM decrypt of the
 * stored ciphertext → if plaintext === marker, success.
 *
 * Biometric: WebAuthn platform authenticator (Touch ID / Face ID / Windows
 * Hello). We register a discoverable (resident) credential once at setup; on
 * unlock we call navigator.credentials.get() with userVerification:'required'.
 * The OS verifies the user; we trust the OS. Biometric is a UX shortcut — the
 * PIN remains the cryptographic factor and is always available as fallback.
 *
 * Auto-lock: Page Visibility API. When the tab is hidden, we record a
 * timestamp; on resume, if hidden-for > autoLockDelay, lock immediately (so the
 * lock screen is present with zero flash-of-unlocked-content).
 *
 * Cool-down: after every 5 failed PIN attempts, lock the pad for 15s → 30s →
 * 60s → 5min, escalating with each successive lockout. Counter persists in
 * localStorage so closing the tab does NOT reset it.
 *
 * Forgot PIN: clears the local encrypted blob only. Server-side inboxes are
 * unaffected.
 *
 * Spec: PRD SECURITY.md "App Lock Flow" + MOTION-SYSTEM.md §9.
 */

import {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock, Fingerprint, Shield, ShieldCheck, ShieldAlert, Trash2, Clock,
  AlertTriangle, CheckCircle2, KeyRound, Eye, Delete,
  X, Loader2, RefreshCw, ScanFace,
} from 'lucide-react'
import { useAppStore, type SectionId } from '@/lib/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'
import { useSound } from '@/hooks/use-settings'

// =============================================================================
// Constants & types
// =============================================================================

const LS_DATA_KEY = 'studenttemp_applock_data'
/** The plaintext marker that gets encrypted at rest. Decrypting back to this
 *  string proves the PIN is correct. It carries no secret meaning. */
const UNLOCK_MARKER = 'studenttemp:applock:valid:v1'
const PBKDF2_ITERATIONS = 100_000 // OWASP-recommended minimum for PBKDF2-SHA256
const SALT_BYTES = 16
const IV_BYTES = 12
const KEY_LENGTH_BITS = 256

const PIN_MIN = 4
const PIN_MAX = 6

/** Auto-lock delay in seconds. 0 means "Never" (manual lock only). */
type AutoLockDelaySeconds = 0 | 120 | 300 | 900

const AUTO_LOCK_OPTIONS: { value: AutoLockDelaySeconds; label: string }[] = [
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 0, label: 'Never (manual only)' },
]

/** Progressive cool-down ladder (seconds) per successive lockout. */
const COOLDOWN_LADDER = [15, 30, 60, 300] // 15s, 30s, 60s, 5min
const MAX_FAILED_BEFORE_COOLDOWN = 5

type PinLength = 4 | 5 | 6

interface AppLockData {
  version: 1
  salt: string           // base64
  iv: string             // base64
  ciphertext: string     // base64 (AES-GCM of UNLOCK_MARKER)
  pinLength: PinLength
  autoLockDelay: AutoLockDelaySeconds
  biometricEnabled: boolean
  biometricCredentialId?: string  // base64 rawId (if a platform credential was registered)
  createdAt: string
  failedAttempts: number
  cooldownUntil: number | null    // epoch ms
}

// =============================================================================
// Crypto helpers (real Web Crypto API)
// =============================================================================

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[])
  }
  return btoa(s)
}

function b64ToBuf(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const bytes = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(new ArrayBuffer(n))
  crypto.getRandomValues(arr)
  return arr
}

async function deriveKey(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptMarker(pin: string): Promise<{ salt: string; iv: string; ciphertext: string; pinLength: PinLength }> {
  const salt = randomBytes(SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const key = await deriveKey(pin, salt)
  const enc = new TextEncoder()
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(UNLOCK_MARKER))
  return {
    salt: bufToB64(salt),
    iv: bufToB64(iv),
    ciphertext: bufToB64(ct),
    pinLength: pin.length as PinLength,
  }
}

async function verifyPin(pin: string, data: AppLockData): Promise<boolean> {
  try {
    const salt = b64ToBuf(data.salt)
    const iv = b64ToBuf(data.iv)
    const ct = b64ToBuf(data.ciphertext)
    const key = await deriveKey(pin, salt)
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
    const text = new TextDecoder().decode(dec)
    return text === UNLOCK_MARKER
  } catch {
    return false
  }
}

// =============================================================================
// localStorage helpers
// =============================================================================

function loadData(): AppLockData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LS_DATA_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.version !== 1) return null
    return parsed as AppLockData
  } catch {
    return null
  }
}

function saveData(data: AppLockData | null): void {
  if (typeof window === 'undefined') return
  if (data === null) localStorage.removeItem(LS_DATA_KEY)
  else localStorage.setItem(LS_DATA_KEY, JSON.stringify(data))
}

// =============================================================================
// WebAuthn helpers (real calls, graceful degradation)
// =============================================================================

type BiometricStatus = 'available' | 'unavailable' | 'unsupported'

async function getBiometricStatus(): Promise<BiometricStatus> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return 'unsupported'
  try {
    const fn = (PublicKeyCredential as unknown as {
      isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>
    }).isUserVerifyingPlatformAuthenticatorAvailable
    if (!fn) return 'unavailable'
    const ok = await fn.call(PublicKeyCredential)
    return ok ? 'available' : 'unavailable'
  } catch {
    return 'unavailable'
  }
}

/** Registers a discoverable (resident) platform credential to use as a local
 *  unlock token. The OS verifies the user; we trust the OS. */
async function registerBiometric(): Promise<string | null> {
  try {
    const challenge = randomBytes(32)
    const userId = randomBytes(16)
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'StudentTemp App Lock' },
        user: {
          id: userId,
          name: 'app-lock-user',
          displayName: 'App Lock',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },    // ES256
          { type: 'public-key', alg: -257 },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'required',
          requireResidentKey: true,
        },
        timeout: 60_000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null
    if (!cred) return null
    return bufToB64(cred.rawId)
  } catch {
    return null
  }
}

async function unlockWithBiometric(credentialId: string): Promise<boolean> {
  try {
    const challenge = randomBytes(32)
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60_000,
        userVerification: 'required',
        allowCredentials: [{
          type: 'public-key',
          id: b64ToBuf(credentialId),
          transports: ['internal'],
        }],
      },
    })
    return !!assertion
  } catch {
    return false
  }
}

// =============================================================================
// PinDots — the row of filled/unfilled dot indicators
// =============================================================================

interface PinDotsProps {
  count: number      // total dots
  filled: number     // how many are filled
  shake?: boolean    // trigger shake animation on incorrect
  error?: boolean
}

function PinDots({ count, filled, shake = false, error = false }: PinDotsProps) {
  return (
    <motion.div
      className="flex items-center justify-center gap-3"
      animate={shake ? { x: [0, -6, 6, -6, 6, -6, 6, 0] } : { x: 0 }}
      transition={shake ? { duration: 0.3, ease: 'easeInOut' } : { duration: 0 }}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => {
        const isFilled = i < filled
        return (
          <motion.span
            key={i}
            className={cn(
              'h-3 w-3 rounded-full border-2 transition-colors',
              isFilled
                ? (error ? 'border-destructive bg-destructive' : 'border-primary bg-primary')
                : 'border-muted-foreground/40 bg-transparent'
            )}
            initial={false}
            // scale-pop on fill: 0 -> 1.2 -> 1.0
            animate={isFilled ? { scale: [1, 1.2, 1] } : { scale: 1 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          />
        )
      })}
    </motion.div>
  )
}

// =============================================================================
// PinPad — the 3x4 grid of digit buttons (1-9, biometric, 0, delete)
// =============================================================================

interface PinPadProps {
  onDigit: (d: string) => void
  onDelete: () => void
  onSubmit: () => void
  onBiometric?: () => void
  showBiometric?: boolean
  biometricBusy?: boolean
  disabled?: boolean
  /** label for the action key (default "delete"). Setup dialog uses "submit". */
  actionVariant?: 'delete' | 'submit'
}

function PinPad({
  onDigit, onDelete, onSubmit, onBiometric,
  showBiometric = false, biometricBusy = false, disabled = false,
  actionVariant = 'delete',
}: PinPadProps) {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

  const btnClass =
    'relative h-16 w-full max-w-[5rem] select-none rounded-2xl border border-border/60 bg-card text-2xl font-medium tabular-nums shadow-sm transition-all hover:bg-accent hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none'

  return (
    <div
      className="mx-auto grid w-full max-w-[20rem] grid-cols-3 gap-3"
      role="group"
      aria-label="PIN pad"
    >
      {digits.map((d) => (
        <button
          key={d}
          type="button"
          className={btnClass}
          onClick={() => onDigit(d)}
          disabled={disabled}
          aria-label={`Digit ${d}`}
        >
          {d}
        </button>
      ))}

      {/* Bottom-left action: biometric OR empty */}
      {showBiometric ? (
        <button
          key="bio"
          type="button"
          className={cn(btnClass, 'text-primary')}
          onClick={onBiometric}
          disabled={disabled || biometricBusy}
          aria-label="Unlock with biometric"
        >
          {biometricBusy
            ? <Loader2 className="h-6 w-6 animate-spin" />
            : <Fingerprint className="h-6 w-6" />}
        </button>
      ) : (
        <span aria-hidden />
      )}

      <button
        key="0"
        type="button"
        className={btnClass}
        onClick={() => onDigit('0')}
        disabled={disabled}
        aria-label="Digit 0"
      >
        0
      </button>

      {/* Bottom-right action: delete OR submit */}
      <button
        key="action"
        type="button"
        className={cn(btnClass, 'text-muted-foreground')}
        onClick={actionVariant === 'submit' ? onSubmit : onDelete}
        disabled={disabled}
        aria-label={actionVariant === 'submit' ? 'Confirm PIN' : 'Delete last digit'}
      >
        {actionVariant === 'submit'
          ? <CheckCircle2 className="h-6 w-6 text-primary" />
          : <Delete className="h-6 w-6" />}
      </button>
    </div>
  )
}

// =============================================================================
// CooldownTimer — countdown shown during progressive lockout
// =============================================================================

function CooldownTimer({ until, onExpire }: { until: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((until - Date.now()) / 1000)))

  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, Math.ceil((until - Date.now()) / 1000))
      setRemaining(r)
      if (r <= 0) { onExpire() }
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [until, onExpire])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const display = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
        <Clock className="h-4 w-4" />
        <span className="text-sm font-medium">Too many attempts</span>
      </div>
      <div className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
        {display}
      </div>
      <div className="text-xs text-muted-foreground">Try again in a moment</div>
    </motion.div>
  )
}

// =============================================================================
// LockScreen overlay — full-screen PIN/biometric unlock gate
// =============================================================================

interface LockScreenProps {
  /** Optional callback fired when the unlock transition finishes. */
  onUnlocked?: () => void
}

export function LockScreen({ onUnlocked }: LockScreenProps) {
  const isLocked = useAppStore((s) => s.isLocked)
  const setLocked = useAppStore((s) => s.setLocked)
  const appLockEnabled = useAppStore((s) => s.appLockEnabled)
  // L2 (GAP-ANALYSIS-V2.md): pending deep-link navigation.
  // When a notification (or other deep-link trigger) is tapped while the app
  // is locked, we stash the intended destination here. On successful unlock
  // we drain it and route the user there. If the user never unlocks (abandons
  // the lock screen), the pending target is discarded on next manual unlock.
  const pendingNavigation = useAppStore((s) => s.pendingNavigation)
  const setPendingNavigation = useAppStore((s) => s.setPendingNavigation)
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const sound = useSound()

  const [data, setData] = useState<AppLockData | null>(null)
  const [mounted, setMounted] = useState(false)
  const [entered, setEntered] = useState('')
  const [shake, setShake] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [bioBusy, setBioBusy] = useState(false)

  // Avoid SSR/CSR mismatch: only act on the client.
  useEffect(() => { setMounted(true) }, [])

  // Hydrate lock data from localStorage.
  useEffect(() => {
    if (!mounted) return
    setData(loadData())
  }, [mounted, isLocked])

  // Reset PIN entry on mount.
  useEffect(() => {
    if (isLocked) { setEntered(''); setShake(false); setUnlocked(false) }
  }, [isLocked])

  // L2: deep-link request listener. When a notification (or any other
  // external trigger) wants to route the user somewhere, it dispatches a
  // `studenttemp:deep-link-request` CustomEvent with `{ section, params }`.
  //   • If the app is currently locked → we stash the target as
  //     pendingNavigation; it'll be drained in `handleUnlocked` after the
  //     user successfully enters their PIN.
  //   • If the app is unlocked → we route immediately.
  useEffect(() => {
    if (!mounted) return
    const onDeepLink = (e: Event) => {
      const detail = (e as CustomEvent<{ section: string; params?: Record<string, string> }>).detail
      if (!detail?.section) return
      const section = detail.section as SectionId
      if (isLocked) {
        setPendingNavigation({ section, params: detail.params })
        toast('Locked — sign in to view', {
          description: 'A link was tapped while the app is locked.',
        })
      } else {
        setActiveSection(section, detail.params ?? {})
      }
    }
    window.addEventListener('studenttemp:deep-link-request', onDeepLink as EventListener)
    return () => window.removeEventListener('studenttemp:deep-link-request', onDeepLink as EventListener)
  }, [mounted, isLocked, setPendingNavigation, setActiveSection])

  const pinLength: PinLength = data?.pinLength ?? 4

  const inCooldown = !!data?.cooldownUntil && data.cooldownUntil > Date.now()
  const cooldownMs = data?.cooldownUntil ?? 0

  const handleUnlocked = useCallback(() => {
    setUnlocked(true)
    sound.playUnlock()
    // Persist: clear failed attempts + cooldown.
    if (data) {
      const next: AppLockData = { ...data, failedAttempts: 0, cooldownUntil: null }
      saveData(next); setData(next)
    }
    // Let the success animation play, then drop the lock for real.
    const t = setTimeout(() => {
      setLocked(false)
      // L2: drain any pending deep-link navigation FIRST. If there is one, we
      // route the user to the originally-intended section (e.g., the message
      // they tapped in a notification) instead of falling through to the
      // default Home section. We clear the pending target before navigating
      // so a re-lock during navigation doesn't double-fire it.
      const pending = pendingNavigation
      if (pending) {
        setPendingNavigation(null)
        setActiveSection(pending.section, pending.params ?? {})
      }
      onUnlocked?.()
    }, 320)
    return () => clearTimeout(t)
  }, [data, onUnlocked, setLocked, sound, pendingNavigation, setPendingNavigation, setActiveSection])

  const submit = useCallback(async (pin: string) => {
    if (!data || verifying || inCooldown) return
    setVerifying(true)
    const ok = await verifyPin(pin, data)
    setVerifying(false)
    if (ok) {
      handleUnlocked()
    } else {
      // Shake, then clear + increment attempts.
      setShake(true)
      sound.playError()
      setTimeout(() => setShake(false), 320)
      setEntered('')
      const attempts = data.failedAttempts + 1
      const next: AppLockData = { ...data, failedAttempts: attempts }
      // Every MAX_FAILED_BEFORE_COOLDOWN failures → escalate.
      if (attempts % MAX_FAILED_BEFORE_COOLDOWN === 0) {
        const idx = Math.min(
          Math.floor(attempts / MAX_FAILED_BEFORE_COOLDOWN) - 1,
          COOLDOWN_LADDER.length - 1
        )
        next.cooldownUntil = Date.now() + COOLDOWN_LADDER[idx] * 1000
        toast.error(`Too many attempts. Locked for ${formatDuration(COOLDOWN_LADDER[idx])}.`)
      } else {
        toast.error('Wrong PIN', {
          description: `${MAX_FAILED_BEFORE_COOLDOWN - (attempts % MAX_FAILED_BEFORE_COOLDOWN)} attempts before cooldown`,
        })
      }
      saveData(next); setData(next)
    }
  }, [data, verifying, inCooldown, sound, handleUnlocked])

  const tryBiometric = useCallback(async () => {
    if (!data?.biometricCredentialId || bioBusy) return
    setBioBusy(true)
    const ok = await unlockWithBiometric(data.biometricCredentialId)
    setBioBusy(false)
    if (ok) {
      handleUnlocked()
    } else {
      toast('Biometric unavailable', {
        description: 'Use your PIN to unlock',
      })
    }
  }, [data, bioBusy, handleUnlocked])

  // Auto-trigger biometric when the lock screen first appears (one-shot).
  const autoBioTriedRef = useRef(false)
  useEffect(() => {
    if (!mounted || !isLocked || !data) return
    if (autoBioTriedRef.current) return
    autoBioTriedRef.current = true
    if (data.biometricEnabled && data.biometricCredentialId) {
      // Defer so the lock screen paints first (zero-flash).
      const t = setTimeout(() => { void tryBiometric() }, 300)
      return () => clearTimeout(t)
    }
  }, [mounted, isLocked, data, tryBiometric])

  // Reset the auto-bio ref when the lock re-engages.
  useEffect(() => {
    if (isLocked) autoBioTriedRef.current = false
  }, [isLocked])

  // ---- focus trap (keyboard nav within the lock screen) ----
  const containerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!isLocked || !mounted) return
    const node = containerRef.current
    if (!node) return
    const focusables = () => Array.from(
      node.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    )
    // Focus the first digit by default.
    const t = setTimeout(() => {
      const fs = focusables()
      // Prefer the biometric button (if present) so user can just press Enter;
      // otherwise focus the digit "5" in the middle.
      const target = fs.find((el) => el.getAttribute('aria-label') === 'Digit 5')
        ?? fs.find((el) => el.getAttribute('aria-label') === 'Unlock with biometric')
        ?? fs[0]
      target?.focus()
    }, 60)
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const fs = focusables()
      if (fs.length === 0) return
      const first = fs[0]
      const last = fs[fs.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }
    node.addEventListener('keydown', handler)
    return () => { clearTimeout(t); node.removeEventListener('keydown', handler) }
  }, [isLocked, mounted])

  // Physical keyboard: digits, Backspace, Enter.
  useEffect(() => {
    if (!isLocked || !mounted) return
    const handler = (e: globalThis.KeyboardEvent) => {
      if (inCooldown || verifying || unlocked) return
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        setEntered((cur) => cur.length < pinLength ? cur + e.key : cur)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setEntered((cur) => cur.slice(0, -1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        setEntered((cur) => {
          if (cur.length === pinLength) void submit(cur)
          return cur
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isLocked, mounted, inCooldown, verifying, unlocked, pinLength, submit])

  // Auto-submit when the user fills the expected PIN length.
  useEffect(() => {
    if (entered.length === pinLength && pinLength > 0) {
      void submit(entered)
    }
  }, [entered, pinLength, submit])

  // ---- render ----
  if (!mounted) return null

  // Don't show the lock screen if App Lock isn't enabled at all.
  const shouldShow = isLocked && appLockEnabled
  if (!shouldShow) return null

  // If data isn't loaded yet, show a blank backdrop (zero-flash protection).
  const ready = !!data

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-label="App locked. Enter your PIN to continue."
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md px-4"
          initial={{ opacity: 0 }}
          animate={unlocked ? { opacity: 0, scale: 1.03 } : { opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Brand lock icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.05, type: 'spring', stiffness: 320, damping: 26 }}
            className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30"
          >
            <Lock className="h-7 w-7" />
          </motion.div>

          <h2 className="text-lg font-semibold tracking-tight">StudentTemp is locked</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ready ? 'Enter your PIN to continue' : 'Preparing secure unlock…'}
          </p>

          {/* Dot indicators */}
          <div className="my-6 h-6">
            {ready && (
              <PinDots count={pinLength} filled={entered.length} shake={shake} error={shake} />
            )}
          </div>

          {/* Cooldown OR pin pad */}
          <div className="w-full max-w-xs">
            {inCooldown ? (
              <CooldownTimer until={cooldownMs} onExpire={() => {
                if (!data) return
                const next = { ...data, cooldownUntil: null }
                saveData(next); setData(next)
              }} />
            ) : ready ? (
              <PinPad
                onDigit={(d) => setEntered((cur) => cur.length < pinLength ? cur + d : cur)}
                onDelete={() => setEntered((cur) => cur.slice(0, -1))}
                onSubmit={() => { if (entered.length === pinLength) void submit(entered) }}
                onBiometric={tryBiometric}
                showBiometric={!!data.biometricEnabled && !!data.biometricCredentialId}
                biometricBusy={bioBusy}
                disabled={verifying}
                actionVariant="delete"
              />
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Biometric "breathing" prompt while waiting for the OS */}
          {ready && data.biometricEnabled && data.biometricCredentialId && bioBusy && (
            <motion.div
              className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            >
              <motion.span
                aria-hidden
                animate={{ opacity: [1, 0.7, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="text-primary"
              >
                <Fingerprint className="h-4 w-4" />
              </motion.span>
              Waiting for biometric…
            </motion.div>
          )}

          {/* Footer notice */}
          <p className="mt-8 max-w-xs text-center text-[11px] leading-relaxed text-muted-foreground">
            App Lock protects this device only. Your inboxes on the server are unaffected.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// =============================================================================
// SetupDialog — first-time PIN creation + optional biometric enrollment
// =============================================================================

type SetupStep = 'enter' | 'confirm' | 'biometric'

function SetupDialog({
  open, onOpenChange, bioStatus, onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  bioStatus: BiometricStatus
  onConfirm: (pin: string, useBiometric: boolean) => Promise<void>
}) {
  const [step, setStep] = useState<SetupStep>('enter')
  const [firstPin, setFirstPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [useBiometric, setUseBiometric] = useState(true)
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(false)
  const sound = useSound()

  // Reset on close.
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep('enter'); setFirstPin(''); setConfirmPin(''); setUseBiometric(true); setBusy(false); setShake(false)
      }, 250)
      return () => clearTimeout(t)
    }
  }, [open])

  const dotCount = useMemo(() => {
    // Show min 4 dots; grow up to 6 as the user types more digits.
    return Math.max(PIN_MIN, Math.min(firstPin.length, PIN_MAX))
  }, [firstPin])

  const handleEnterDigit = (d: string) => {
    if (step === 'enter') {
      setFirstPin((cur) => cur.length < PIN_MAX ? cur + d : cur)
    } else if (step === 'confirm') {
      setConfirmPin((cur) => cur.length < firstPin.length ? cur + d : cur)
    }
  }
  const handleDelete = () => {
    if (step === 'enter') setFirstPin((cur) => cur.slice(0, -1))
    else setConfirmPin((cur) => cur.slice(0, -1))
  }
  const handleSubmit = () => {
    if (step === 'enter') {
      if (firstPin.length < PIN_MIN) {
        toast.error('PIN must be at least 4 digits')
        return
      }
      setStep('confirm')
    } else if (step === 'confirm') {
      if (confirmPin !== firstPin) {
        setShake(true); sound.playError()
        setTimeout(() => { setShake(false); setConfirmPin('') }, 320)
        toast.error('PINs do not match', { description: 'Try entering it again' })
        return
      }
      // Skip biometric step if unavailable.
      if (bioStatus === 'available') setStep('biometric')
      else void finalize(false)
    } else if (step === 'biometric') {
      void finalize(useBiometric)
    }
  }

  const finalize = async (withBio: boolean) => {
    setBusy(true)
    await onConfirm(firstPin, withBio)
    setBusy(false)
    onOpenChange(false)
  }

  const currentPin = step === 'enter' ? firstPin : confirmPin
  const currentLen = step === 'enter' ? firstPin.length : confirmPin.length
  const expectedLen = step === 'enter' ? Math.max(PIN_MIN, firstPin.length) : firstPin.length
  const title =
    step === 'enter' ? 'Set your PIN' :
    step === 'confirm' ? 'Confirm your PIN' :
    'Enable biometric?'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {step === 'enter' && 'Pick a 4-6 digit PIN. This PIN is never sent to the server.'}
            {step === 'confirm' && 'Re-enter the PIN to make sure it\'s correct.'}
            {step === 'biometric' && 'Use Touch ID / Face ID / fingerprint to unlock faster? You can always fall back to your PIN.'}
          </DialogDescription>
        </DialogHeader>

        {step !== 'biometric' ? (
          <>
            <div className="flex justify-center py-2">
              <PinDots count={step === 'enter' ? dotCount : expectedLen} filled={currentLen} shake={shake} error={shake} />
            </div>
            <PinPad
              onDigit={handleEnterDigit}
              onDelete={handleDelete}
              onSubmit={handleSubmit}
              actionVariant={currentLen >= PIN_MIN ? 'submit' : 'delete'}
              disabled={busy}
            />
            {step === 'enter' && (
              <p className="text-center text-[11px] text-muted-foreground">
                {firstPin.length < PIN_MIN
                  ? `${PIN_MIN - firstPin.length} more digit${PIN_MIN - firstPin.length === 1 ? '' : 's'} minimum`
                  : `${firstPin.length}-digit PIN`}
              </p>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
              <Fingerprint className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Biometric unlock</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Your device will prompt you to authenticate. The PIN you just set always works as a fallback.
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => void finalize(false)} disabled={busy}>
                Skip
              </Button>
              <Button className="flex-1 gap-2" onClick={() => void finalize(true)} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
                Enable biometric
              </Button>
            </div>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {(['enter', 'confirm', 'biometric'] as SetupStep[])
            .filter((s) => bioStatus === 'available' || s !== 'biometric')
            .map((s) => (
              <span
                key={s}
                className={cn(
                  'h-1.5 w-6 rounded-full transition-colors',
                  s === step ? 'bg-primary' : (stepOrder(step) > stepOrder(s) ? 'bg-primary/40' : 'bg-muted')
                )}
              />
            ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function stepOrder(s: SetupStep): number {
  return s === 'enter' ? 0 : s === 'confirm' ? 1 : 2
}

// =============================================================================
// ChangePINDialog — verify old PIN, then set a new one
// =============================================================================

function ChangePINDialog({
  open, onOpenChange, currentData, onChanged,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  currentData: AppLockData
  onChanged: (next: AppLockData) => void
}) {
  const [phase, setPhase] = useState<'old' | 'new' | 'confirm'>('old')
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(false)
  const sound = useSound()

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setPhase('old'); setOldPin(''); setNewPin(''); setConfirmPin(''); setBusy(false); setShake(false)
      }, 250)
      return () => clearTimeout(t)
    }
  }, [open])

  const expectedLen =
    phase === 'old' ? currentData.pinLength :
    phase === 'new' ? Math.max(PIN_MIN, newPin.length) :
    newPin.length

  const currentPin = phase === 'old' ? oldPin : phase === 'new' ? newPin : confirmPin
  const currentLen = currentPin.length
  const maxLen = phase === 'old' ? currentData.pinLength : PIN_MAX

  const handleDigit = (d: string) => {
    if (phase === 'old') setOldPin((c) => c.length < currentData.pinLength ? c + d : c)
    else if (phase === 'new') setNewPin((c) => c.length < PIN_MAX ? c + d : c)
    else setConfirmPin((c) => c.length < newPin.length ? c + d : c)
  }
  const handleDelete = () => {
    if (phase === 'old') setOldPin((c) => c.slice(0, -1))
    else if (phase === 'new') setNewPin((c) => c.slice(0, -1))
    else setConfirmPin((c) => c.slice(0, -1))
  }
  const handleSubmit = async () => {
    if (phase === 'old') {
      if (oldPin.length !== currentData.pinLength) return
      setBusy(true)
      const ok = await verifyPin(oldPin, currentData)
      setBusy(false)
      if (!ok) {
        setShake(true); sound.playError()
        setTimeout(() => { setShake(false); setOldPin('') }, 320)
        toast.error('Current PIN is incorrect')
        return
      }
      setPhase('new')
    } else if (phase === 'new') {
      if (newPin.length < PIN_MIN) {
        toast.error('PIN must be at least 4 digits')
        return
      }
      setPhase('confirm')
    } else if (phase === 'confirm') {
      if (confirmPin !== newPin) {
        setShake(true); sound.playError()
        setTimeout(() => { setShake(false); setConfirmPin('') }, 320)
        toast.error('PINs do not match')
        return
      }
      setBusy(true)
      const enc = await encryptMarker(newPin)
      const next: AppLockData = {
        ...currentData,
        ...enc,
        failedAttempts: 0,
        cooldownUntil: null,
        createdAt: new Date().toISOString(),
      }
      saveData(next)
      setBusy(false)
      onChanged(next)
      toast.success('PIN changed')
      onOpenChange(false)
    }
  }

  const title =
    phase === 'old' ? 'Enter current PIN' :
    phase === 'new' ? 'Set a new PIN' :
    'Confirm new PIN'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {phase === 'old' && 'Verify it\'s you first.'}
            {phase === 'new' && 'Pick a new 4-6 digit PIN.'}
            {phase === 'confirm' && 'Re-enter the new PIN to confirm.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-2">
          <PinDots count={expectedLen} filled={currentLen} shake={shake} error={shake} />
        </div>
        <PinPad
          onDigit={handleDigit}
          onDelete={handleDelete}
          onSubmit={handleSubmit}
          actionVariant={currentLen >= (phase === 'old' ? currentData.pinLength : PIN_MIN) ? 'submit' : 'delete'}
          disabled={busy}
        />
        {busy && (
          <div className="flex items-center justify-center text-xs text-muted-foreground gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying…
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// useAutoLock — Page Visibility API hook (exported for AppShell to use)
// =============================================================================

/**
 * Watches the document visibility state and locks the app when the tab is
 * backgrounded for longer than the configured delay. Also exposes a manual
 * `lockNow` callback. No-op when App Lock is disabled.
 *
 * Mount this once at the app root (AppShell) so the lock triggers regardless
 * of which section is currently active.
 */
export function useAutoLock() {
  const appLockEnabled = useAppStore((s) => s.appLockEnabled)
  const isLocked = useAppStore((s) => s.isLocked)
  const setLocked = useAppStore((s) => s.setLocked)
  const hiddenAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (!appLockEnabled) return
    if (typeof document === 'undefined') return

    const onVisChange = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now()
      } else {
        const hiddenAt = hiddenAtRef.current
        hiddenAtRef.current = null
        if (hiddenAt == null) return
        const data = loadData()
        const delay = data?.autoLockDelay ?? 120
        if (delay <= 0) return // Never
        const elapsed = Date.now() - hiddenAt
        if (elapsed >= delay * 1000) {
          // Lock while still hidden→visible transition; the lock screen mounts
          // before the user can see the unlocked content (zero-flash).
          setLocked(true)
        }
      }
    }

    const onBlur = () => {
      // Some browsers fire `blur` without `visibilitychange` on quick tab switches.
      // We rely on visibilitychange as the source of truth; blur is a fallback.
      if (document.visibilityState === 'hidden') return
      // No-op: page is still visible, just lost focus.
    }

    document.addEventListener('visibilitychange', onVisChange)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('visibilitychange', onVisChange)
      window.removeEventListener('blur', onBlur)
    }
  }, [appLockEnabled, setLocked])

  const lockNow = useCallback(() => {
    setLocked(true)
  }, [setLocked])

  return { lockNow, isLocked }
}

// =============================================================================
// AppLockSection — settings UI
// =============================================================================

export function AppLockSection({ triggerGenerate: _triggerGenerate }: { triggerGenerate: (email: string) => void }) {
  const appLockEnabled = useAppStore((s) => s.appLockEnabled)
  const setAppLockEnabled = useAppStore((s) => s.setAppLockEnabled)
  const setLocked = useAppStore((s) => s.setLocked)

  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<AppLockData | null>(null)
  const [bioStatus, setBioStatus] = useState<BiometricStatus>('unsupported')
  const [setupOpen, setSetupOpen] = useState(false)
  const [changeOpen, setChangeOpen] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    setData(loadData())
    void getBiometricStatus().then(setBioStatus)
  }, [])

  // Keep local data state in sync if the store flag flips.
  useEffect(() => {
    if (appLockEnabled && !data) setData(loadData())
    if (!appLockEnabled && data) setData(null)
  }, [appLockEnabled, data])

  // ---- handlers ----
  const handleToggle = (next: boolean) => {
    if (next) {
      // Need to set up a PIN first.
      if (typeof crypto === 'undefined' || !crypto.subtle) {
        toast.error('App Lock unavailable', {
          description: 'Web Crypto requires a secure (HTTPS) context.',
        })
        return
      }
      setSetupOpen(true)
    } else {
      // Disable: clear local encrypted state.
      saveData(null)
      setData(null)
      setAppLockEnabled(false)
      setLocked(false)
      toast.success('App Lock disabled')
    }
  }

  const handleSetupConfirm = async (pin: string, useBiometric: boolean) => {
    let bioCredId: string | undefined
    if (useBiometric) {
      const credId = await registerBiometric()
      if (credId) {
        bioCredId = credId
        toast.success('Biometric enabled')
      } else {
        toast('Biometric enrollment failed', {
          description: 'PIN-only mode active. You can retry from settings.',
        })
      }
    }
    const enc = await encryptMarker(pin)
    const next: AppLockData = {
      version: 1,
      ...enc,
      autoLockDelay: 120,
      biometricEnabled: !!bioCredId,
      biometricCredentialId: bioCredId,
      createdAt: new Date().toISOString(),
      failedAttempts: 0,
      cooldownUntil: null,
    }
    saveData(next)
    setData(next)
    setAppLockEnabled(true)
    toast.success('App Lock enabled', {
      description: bioCredId ? 'PIN + biometric ready' : 'PIN ready',
    })
  }

  const handleAutoLockChange = (v: AutoLockDelaySeconds) => {
    if (!data) return
    const next = { ...data, autoLockDelay: v }
    saveData(next)
    setData(next)
    toast.success('Auto-lock delay updated')
  }

  const handleBiometricToggle = async (enable: boolean) => {
    if (!data) return
    if (enable) {
      const credId = await registerBiometric()
      if (!credId) {
        toast.error('Biometric enrollment failed')
        return
      }
      const next = { ...data, biometricEnabled: true, biometricCredentialId: credId }
      saveData(next); setData(next)
      toast.success('Biometric enabled')
    } else {
      const next = { ...data, biometricEnabled: false, biometricCredentialId: undefined }
      saveData(next); setData(next)
      toast.success('Biometric disabled')
    }
  }

  const handleForgot = () => {
    saveData(null)
    setData(null)
    setAppLockEnabled(false)
    setLocked(false)
    setForgotOpen(false)
    toast.success('Local App Lock data cleared', {
      description: 'Your inboxes are unaffected.',
    })
  }

  const handleLockNow = () => {
    setLocked(true)
    toast('Locked', { description: 'Enter your PIN to resume' })
  }

  const handleTestLock = () => {
    // Demo helper: locks immediately so the user can see the LockScreen overlay.
    setLocked(true)
  }

  // ---- render ----
  // SSR fallback to avoid hydration mismatch (store flag hydrates client-side).
  if (!mounted) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-500" /> App Lock
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-500" /> App Lock
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Protect this device&apos;s UI from casual shoulder-surfing when you step away.
        </p>
      </div>

      {/* Notice */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-700 dark:text-amber-400">Local convenience feature</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            App Lock is a local convenience feature, not a substitute for account security. Anyone with
            physical access to this device could still clear browser data to bypass it. The server-side
            inbox contents are never affected by App Lock.
          </p>
        </div>
      </div>

      {/* Enable toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-emerald-500" /> App Lock
          </CardTitle>
          <CardDescription>
            Require a PIN (or biometric) to view StudentTemp on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 py-1">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
              {appLockEnabled
                ? <ShieldCheck className="h-4 w-4 text-emerald-500" />
                : <ShieldAlert className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">
                {appLockEnabled ? 'App Lock is on' : 'App Lock is off'}
              </div>
              <div className="text-xs text-muted-foreground">
                {appLockEnabled
                  ? `Locked with a ${data?.pinLength ?? 4}-digit PIN${data?.biometricEnabled ? ' + biometric' : ''}.`
                  : 'Enable to require a PIN when the app is backgrounded.'}
              </div>
              {appLockEnabled && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" /> PIN set
                  </Badge>
                  {data?.biometricEnabled && (
                    <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      <Fingerprint className="h-3 w-3" /> Biometric
                    </Badge>
                  )}
                  <Badge variant="outline" className="gap-1 bg-muted">
                    <Clock className="h-3 w-3" />
                    {data?.autoLockDelay ? formatDuration(data.autoLockDelay) : 'Never'}
                  </Badge>
                </div>
              )}
            </div>
            <Switch checked={appLockEnabled} onCheckedChange={handleToggle} aria-label="Toggle App Lock" />
          </div>
        </CardContent>
      </Card>

      {/* Settings (only when enabled) */}
      {appLockEnabled && data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-emerald-500" /> Settings
            </CardTitle>
            <CardDescription>Tune the lock behaviour on this device.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Auto-lock delay */}
            <SettingRow
              icon={<Clock className="h-4 w-4" />}
              title="Auto-lock delay"
              desc="Lock automatically when this tab is hidden for longer than this."
            >
              <Select
                value={String(data.autoLockDelay)}
                onValueChange={(v) => handleAutoLockChange(Number(v) as AutoLockDelaySeconds)}
              >
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUTO_LOCK_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>

            {/* Biometric toggle (only if platform authenticator is available) */}
            {bioStatus === 'available' && (
              <SettingRow
                icon={<Fingerprint className="h-4 w-4 text-primary" />}
                title="Biometric unlock"
                desc="Use Touch ID / Face ID / fingerprint. PIN always works as a fallback."
              >
                <Switch
                  checked={data.biometricEnabled}
                  onCheckedChange={handleBiometricToggle}
                  aria-label="Toggle biometric unlock"
                />
              </SettingRow>
            )}

            {/* Change PIN */}
            <SettingRow
              icon={<RefreshCw className="h-4 w-4" />}
              title="Change PIN"
              desc="Verify your current PIN, then pick a new one."
            >
              <Button variant="outline" size="sm" onClick={() => setChangeOpen(true)}>
                Change
              </Button>
            </SettingRow>

            {/* Lock now */}
            <SettingRow
              icon={<Lock className="h-4 w-4" />}
              title="Lock now"
              desc="Immediately require a PIN to continue."
            >
              <Button variant="outline" size="sm" onClick={handleLockNow} className="gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Lock
              </Button>
            </SettingRow>

            {/* Test lock (demo) */}
            <SettingRow
              icon={<Eye className="h-4 w-4" />}
              title="Preview lock screen"
              desc="See the unlock UI without changing settings."
            >
              <Button variant="ghost" size="sm" onClick={handleTestLock}>
                Preview
              </Button>
            </SettingRow>
          </CardContent>
        </Card>
      )}

      {/* Forgot PIN / reset */}
      {appLockEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
              <Trash2 className="h-4 w-4" /> Reset
            </CardTitle>
            <CardDescription>Clear local App Lock data on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <SettingRow
              icon={<Trash2 className="h-4 w-4 text-red-500" />}
              title="Forgot PIN"
              desc="Clears the local encrypted marker. You'll need to set up App Lock again. Server-side inboxes are NOT affected."
              danger
            >
              <AlertDialog open={forgotOpen} onOpenChange={setForgotOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-red-500 border-red-500/30 hover:bg-red-500/10">
                    Forgot PIN
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear local App Lock data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the encrypted unlock marker, salt, and biometric enrollment from this
                      browser. App Lock will be turned off. Your inboxes on the server are completely
                      unaffected. You can set up App Lock again afterwards.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={handleForgot}
                    >
                      Clear local data
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SettingRow>
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-emerald-500" /> How App Lock works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="crypto">
              <AccordionTrigger className="text-sm">Where is my PIN stored?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Nowhere in plaintext. Your PIN is run through PBKDF2-SHA256 (100,000 iterations) with a
                random 16-byte salt to derive an AES-GCM key. That key encrypts a known marker string, and
                only the encrypted marker, salt, and IV are stored in your browser&apos;s localStorage. The
                server never sees the PIN or the encrypted marker.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="bio">
              <AccordionTrigger className="text-sm">How does biometric unlock work?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                If your device supports a platform authenticator (Touch ID, Face ID, Windows Hello,
                Android fingerprint), we register a discoverable credential at setup. On unlock, we ask
                the OS to verify you (userVerification: &quot;required&quot;). If the OS confirms it&apos;s
                you, the app unlocks. Your PIN always works as a fallback if biometric fails.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="autolock">
              <AccordionTrigger className="text-sm">When does it auto-lock?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                When the tab is hidden (you switch tabs, minimize the browser, or lock your screen) for
                longer than the auto-lock delay. You can also lock manually anytime with the
                &quot;Lock&quot; button. The lock screen mounts before the page becomes visible again,
                so there&apos;s no flash of unlocked content.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="forgot">
              <AccordionTrigger className="text-sm">What if I forget my PIN?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Tap &quot;Forgot PIN&quot; to clear the local encrypted state. This only affects this
                browser&apos;s App Lock — your server-side inboxes are completely safe. You can set up
                App Lock again immediately.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="bruteforce">
              <AccordionTrigger className="text-sm">What stops brute-force guessing?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                After every 5 failed attempts, the PIN pad locks for an escalating cool-down (15s → 30s
                → 60s → 5min). The counter persists across browser restarts, so closing the tab does not
                reset it.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Biometric availability indicator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScanFace className="h-4 w-4 text-emerald-500" /> Device capabilities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            <CapabilityRow
              label="Web Crypto (PBKDF2 + AES-GCM)"
              ok={typeof crypto !== 'undefined' && !!crypto.subtle}
              okLabel="Available"
              badLabel="Unavailable (needs HTTPS)"
            />
            <CapabilityRow
              label="Platform authenticator (biometric)"
              ok={bioStatus === 'available'}
              okLabel="Available"
              badLabel={bioStatus === 'unsupported' ? 'Not supported' : 'Not configured'}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            App Lock works without biometric — PIN-only is always supported.
          </p>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <SetupDialog
        open={setupOpen}
        onOpenChange={setSetupOpen}
        bioStatus={bioStatus}
        onConfirm={handleSetupConfirm}
      />
      {data && (
        <ChangePINDialog
          open={changeOpen}
          onOpenChange={setChangeOpen}
          currentData={data}
          onChanged={(next) => setData(next)}
        />
      )}

      {/* LockScreen overlay — rendered locally so the "Lock now" / "Preview"
          actions work within this section. For app-wide auto-lock, AppShell
          should mount <LockScreen /> globally as well (it's a no-op when
          isLocked is false). */}
      <LockScreen />
    </div>
  )
}

// =============================================================================
// Small presentational helpers
// =============================================================================

function SettingRow({
  icon, title, desc, danger, children,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${danger ? 'bg-red-500/10' : 'bg-muted'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function CapabilityRow({
  label, ok, okLabel, badLabel,
}: { label: string; ok: boolean; okLabel: string; badLabel: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-2.5">
      <span className={cn(
        'grid h-6 w-6 place-items-center rounded-full',
        ok ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'
      )}>
        {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate">{label}</div>
        <div className="text-[11px] text-muted-foreground">{ok ? okLabel : badLabel}</div>
      </div>
    </div>
  )
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'Never'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    return m === 1 ? '1 minute' : `${m} minutes`
  }
  const h = Math.floor(seconds / 3600)
  return h === 1 ? '1 hour' : `${h} hours`
}

'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Settings as SettingsIcon, Moon, Sun, Bell, Volume2, Trash2, Download,
  ShieldCheck, Github, Heart, Clock, AtSign, Flame, Palette, Database, AlertTriangle,
  Globe, Check, Mail, Send, RefreshCw,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { useI18n } from '@/hooks/use-i18n'
import { LOCALES } from '@/lib/i18n'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'

// Local-only settings (persisted to localStorage — no account needed)
const LS_KEY = 'studenttemp_settings'
interface LocalSettings {
  soundEnabled: boolean
  autoDeleteOnRead: boolean
  defaultLifetime: number
  defaultDomain: string
  burnOnRead: boolean
  reduceMotion: boolean
  compactMessageList: boolean
}

const DEFAULT_SETTINGS: LocalSettings = {
  soundEnabled: false,
  autoDeleteOnRead: false,
  defaultLifetime: 10,
  defaultDomain: 'studentbox.in',
  burnOnRead: false,
  reduceMotion: false,
  compactMessageList: false,
}

function loadSettings(): LocalSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(s: LocalSettings) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify(s))
}

export function SettingsSection({ triggerGenerate: _triggerGenerate }: { triggerGenerate: (email: string) => void }) {
  const [settings, setSettings] = useState<LocalSettings>(DEFAULT_SETTINGS)
  const inboxes = useAppStore((s) => s.inboxes)
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const queryClient = useQueryClient()
  const { t } = useI18n()

  const { data: domainsData } = useQuery({ queryKey: ['domains'], queryFn: api.getDomains, staleTime: Infinity })
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: api.getStats, refetchInterval: 30_000 })

  useEffect(() => {
    setSettings(loadSettings())
  }, [])

  const update = (patch: Partial<LocalSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
    toast.success('Settings saved', { duration: 1500 })
  }

  const clearAllInboxes = async () => {
    if (!confirm(`Delete all ${inboxes.length} active inbox(es)? This cannot be undone.`)) return
    for (const inbox of inboxes) {
      try {
        await api.deleteInbox(inbox.id)
      } catch (e) {
        // ignore
      }
    }
    queryClient.invalidateQueries({ queryKey: ['inboxes'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
    toast.success('All inboxes cleared')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-emerald-500" /> {t('settings.title')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t('settings.preferencesSaved')}
        </p>
      </div>

      {/* Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-emerald-500" /> {t('settings.newInboxDefaults')}</CardTitle>
          <CardDescription>{t('settings.appliedWhenGenerating')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default lifetime</Label>
              <Select value={String(settings.defaultLifetime)} onValueChange={(v) => update({ defaultLifetime: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {domainsData?.lifetimeOptions.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default domain</Label>
              <Select value={settings.defaultDomain} onValueChange={(v) => update({ defaultDomain: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {domainsData?.domains && (() => {
                    const packs: Record<string, string> = {
                      indian_student: '🇮🇳 India Student',
                      standard: '🇮🇳 India General',
                      international: '🌍 International',
                      privacy: '🔒 Privacy',
                      academic: '🎓 Academic (.edu/.ac.in)',
                    }
                    const grouped: Record<string, typeof domainsData.domains> = {}
                    for (const d of domainsData.domains) {
                      const key = d.pack || 'standard'
                      if (!grouped[key]) grouped[key] = []
                      grouped[key].push(d)
                    }
                    return Object.entries(grouped).map(([pack, packDomains]) => (
                      <div key={pack}>
                        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {packs[pack] || pack}
                        </div>
                        {packDomains.map((d) => (
                          <SelectItem key={d.domain} value={d.domain} className="gap-1">
                            <span className="font-mono text-xs">@{d.domain}</span>
                          </SelectItem>
                        ))}
                      </div>
                    ))
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>
          <SettingRow
            icon={<Flame className="h-4 w-4 text-orange-500" />}
            title="Burn-on-read by default"
            desc="New inboxes auto-expire 60 seconds after the first message is read."
          >
            <Switch checked={settings.burnOnRead} onCheckedChange={(v) => update({ burnOnRead: v })} />
          </SettingRow>
        </CardContent>
      </Card>

      {/* Appearance & Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Globe className="h-4 w-4 text-emerald-500" /> Appearance & language</CardTitle>
          <CardDescription>Choose your interface language and theme.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Language / भाषा</Label>
            <LanguageSwitcher />
            <p className="text-xs text-muted-foreground">More languages coming soon (Odia, Telugu, Tamil, Bengali, Marathi).</p>
          </div>
          <SettingRow
            icon={<Palette className="h-4 w-4" />}
            title="Reduce motion"
            desc="Disable scramble, slide, and reveal animations."
          >
            <Switch checked={settings.reduceMotion} onCheckedChange={(v) => update({ reduceMotion: v })} />
          </SettingRow>
          <SettingRow
            icon={<AtSign className="h-4 w-4" />}
            title="Compact message list"
            desc="Show more messages per screen with denser rows."
          >
            <Switch checked={settings.compactMessageList} onCheckedChange={(v) => update({ compactMessageList: v })} />
          </SettingRow>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4 text-emerald-500" /> {t('settings.notificationsFeedback')}</CardTitle>
          <CardDescription>{t('settings.controlHow')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow
            icon={<Volume2 className="h-4 w-4" />}
            title="Sound on new message"
            desc="Play a soft chime when mail arrives. Off by default."
          >
            <Switch checked={settings.soundEnabled} onCheckedChange={(v) => update({ soundEnabled: v })} />
          </SettingRow>
          <SettingRow
            icon={<Bell className="h-4 w-4" />}
            title="Desktop notifications"
            desc="Get a browser notification when new mail arrives."
          >
            <PushNotificationToggle />
          </SettingRow>
        </CardContent>
      </Card>

      {/* Data & privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-emerald-500" /> {t('settings.dataPrivacy')}</CardTitle>
          <CardDescription>{t('settings.manageData')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Active inboxes" value={stats?.session.activeInboxes ?? 0} />
            <Stat label="Total created" value={stats?.session.totalInboxes ?? 0} />
            <Stat label="Messages received" value={stats?.session.totalMessages ?? 0} />
            <Stat label="Unread" value={stats?.session.unreadMessages ?? 0} />
          </div>

          <SettingRow
            icon={<Trash2 className="h-4 w-4 text-red-500" />}
            title="Clear all active inboxes"
            desc="Immediately delete all inboxes and their messages."
            danger
          >
            <Button variant="outline" size="sm" className="text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={clearAllInboxes} disabled={inboxes.length === 0}>
              Clear ({inboxes.length})
            </Button>
          </SettingRow>

          <SettingRow
            icon={<Download className="h-4 w-4" />}
            title="Export data"
            desc="Download all your inbox metadata and messages as JSON."
          >
            <Button variant="outline" size="sm" onClick={() => exportData()}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export
            </Button>
          </SettingRow>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Account Mode — section reserved for the future permanent-mailbox tier. */}
      {/* Not implemented yet (no login system). The card documents the      */}
      {/* cross-cutting cleanup / conflict logic required when this tier     */}
      {/* ships, so the requirements aren't lost between now and the actual  */}
      {/* Account Mode build.                                                */}
      {/* ----------------------------------------------------------------- */}
      {/* L3 (GAP-ANALYSIS-V2.md) — Filter conflict resolution: */}
      {/*   When a new message matches multiple filters, the actions execute  */}
      {/*   in priority order with these rules:                              */}
      {/*   • "Forward" actions always execute regardless of later "Delete"  */}
      {/*     actions in the chain (a copy is forwarded before deletion).    */}
      {/*   • "Delete" halts further filter evaluation immediately after    */}
      {/*     any pending Forward completes.                                 */}
      {/*   • Multiple "Apply label" actions from different matching         */}
      {/*     filters are all additive (a message can carry several labels   */}
      {/*     from several filters simultaneously).                          */}
      {/*                                                                    */}
      {/* L5 (GAP-ANALYSIS-V2.md) — Account deletion cleanup: */}
      {/*   On a DELETE account request:                                     */}
      {/*   • Cancel all pending Scheduled Sends immediately (never fire    */}
      {/*     mail after account deletion).                                  */}
      {/*   • Disable the Vacation Responder immediately.                   */}
      {/*   • Revoke all App Passwords, IMAP/SMTP sessions, and active      */}
      {/*     login sessions instantly.                                       */}
      {/*   • Enter a 14-day grace-deletion window (soft-deleted,           */}
      {/*     recoverable via re-login). Document this clearly in the       */}
      {/*     deletion confirmation UI: "Your account will be permanently   */}
      {/*     deleted in 14 days unless you sign back in."                   */}
      {/*   • On grace window expiry → real, permanent, irreversible purge  */}
      {/*     of mail, attachments, contacts, and metadata.                  */}
      {/*                                                                    */}
      {/* G9 (GAP-ANALYSIS-V2.md) — Send-as alias reply-from logic:          */}
      {/*   Documented inline in `ReplyDialog` (src/components/sections/    */}
      {/*   messages-section.tsx). When replying to a message sent to an     */}
      {/*   alias, default From = that alias (not primary), and the alias's  */}
      {/*   configured signature is auto-inserted.                           */}
      <Card className="border-dashed border-emerald-500/30 bg-emerald-500/[0.02]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" /> Account Mode (coming soon)
          </CardTitle>
          <CardDescription>
            Permanent mailboxes, scheduled sends, filters, vacation responder, and account-deletion safeguards.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Account Mode is the future permanent-mailbox tier (separate from the anonymous
            Temporary Mode you are using right now). The following conditional logic is specified
            but not yet wired in code — it lands when the account system ships.
          </p>
          <ul className="space-y-2 list-disc pl-5 text-xs">
            <li>
              <span className="font-medium text-foreground">Filter conflict resolution (L3):</span>{' '}
              Forward actions always execute before Delete; Delete halts further filter evaluation
              after pending Forwards complete; multiple Apply-label actions are additive.
            </li>
            <li>
              <span className="font-medium text-foreground">Account deletion cleanup (L5):</span>{' '}
              Cancels scheduled sends, disables the vacation responder, revokes all sessions and
              App Passwords, and enters a 14-day grace window before the permanent purge of mail,
              contacts, and metadata.
            </li>
            <li>
              <span className="font-medium text-foreground">Send-as alias (G9):</span>{' '}
              Replying to a message sent to an alias defaults From to that alias and inserts the
              alias's configured signature.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* FAQ accordion */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Frequently asked</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="q1">
              <AccordionTrigger className="text-sm">Is this really anonymous?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Yes. We never ask for your name, email, or phone. A random session ID is stored in a cookie so you can manage your inboxes across refreshes — that's it. No IP logging beyond standard rate-limiting.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2">
              <AccordionTrigger className="text-sm">Can I receive real email here?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                In production, StudentTemp runs a real SMTP receiver. This demo generates realistic incoming mail (OTP codes, registration confirmations, newsletters) on a schedule so you can experience the full flow without a real mail server.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q3">
              <AccordionTrigger className="text-sm">What happens when an inbox expires?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                The inbox and all its messages are permanently deleted from our database. Custom local-parts enter a 5-minute cooldown before anyone else can claim them, to prevent targeted hijacking of "waited-for" addresses.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q4">
              <AccordionTrigger className="text-sm">Should I use this for important accounts?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span>No. Anyone who knows the address can read the mail. Use it for one-time verifications, throwaway sign-ups, and testing — never for banking, primary email, or anything tied to your real identity.</span>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Contact & Support (GAP M8) */}
      <ContactSupportCard />

      {/* About footer */}
      <div className="rounded-xl border border-border/60 bg-muted/40 p-5 text-center">
        <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-foreground/80">
          Built with <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" /> for students & developers
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">StudentTemp · Privacy-first disposable email · No tracking, no sign-up</p>
      </div>
    </div>
  )
}

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
    <div className="flex items-center gap-3 py-2.5">
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${danger ? 'bg-red-500/10' : 'bg-muted'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium leading-tight">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</div>
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3.5 border border-border/30">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  )
}

async function exportData() {
  try {
    const [inboxesRes, statsRes] = await Promise.all([api.listInboxes(), api.getStats()])
    const exportObj = {
      exportedAt: new Date().toISOString(),
      stats: statsRes,
      inboxes: inboxesRes.inboxes,
      notes: 'StudentTemp data export. Inboxes and messages are also stored on the server until they expire.',
    }
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `studenttemp-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Data exported')
  } catch (e) {
    toast.error('Export failed')
  }
}

// ---------- Language Switcher ----------
function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {LOCALES.map((l) => (
        <button
          key={l.code}
          onClick={() => setLocale(l.code)}
          className={cn(
            'flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors text-left',
            locale === l.code
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-accent'
          )}
        >
          <span className="flex items-center gap-2">
            <span className="text-base">{l.code === 'en' ? '🇬🇧' : '🇮🇳'}</span>
            <span className="truncate">{l.nativeLabel}</span>
          </span>
          {locale === l.code && <Check className="h-4 w-4 shrink-0" />}
        </button>
      ))}
    </div>
  )
}

// ---------- Push Notification Toggle ----------
function PushNotificationToggle() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const [subscribed, setSubscribed] = useState(false)
  const { setPushPromptDismissed } = useAppStore()
  const queryClient = useQueryClient()

  useEffect(() => {
    // Check if we already have a subscription
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker?.ready?.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    }).catch(() => {})
  }, [])

  if (permission === 'unsupported') {
    return <Badge variant="outline" className="text-amber-600 border-amber-500/30">Unsupported</Badge>
  }

  const handleToggle = async () => {
    if (subscribed) {
      // Unsubscribe
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await sub.unsubscribe()
          await api.unsubscribePush(sub.endpoint).catch(() => {})
        }
        setSubscribed(false)
        setPushPromptDismissed(true)
        toast.success('Notifications disabled')
      } catch (e) {
        toast.error('Failed to disable notifications')
      }
      return
    }
    // Request permission (real PushManager)
    const perm = await Notification.requestPermission()
    setPermission(perm)
    if (perm !== 'granted') {
      toast.error('Notification permission denied')
      return
    }
    // Subscribe via PushManager (real Web Push with real VAPID keys)
    try {
      const reg = await navigator.serviceWorker.ready
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        toast.error('VAPID keys not configured on the server')
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
      const subJson = sub.toJSON()
      await api.subscribePush({
        endpoint: subJson.endpoint || '',
        keys: { p256dh: subJson.keys?.p256dh || '', auth: subJson.keys?.auth || '' },
      })
      setSubscribed(true)
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Notifications enabled', {
        description: 'You\'ll receive real push notifications when new mail arrives.',
      })
    } catch (e) {
      toast.error('Failed to subscribe: ' + (e as Error).message)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Switch checked={subscribed} onCheckedChange={handleToggle} />
      {permission === 'denied' && (
        <Badge variant="outline" className="text-red-600 border-red-500/30 text-[10px]">Blocked</Badge>
      )}
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i)
  return output
}

// ---------- Contact & Support Card (GAP M8) ----------
function ContactSupportCard() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [honeypot, setHoneypot] = useState('') // hidden field for bots
  const [sending, setSending] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message, website: honeypot }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      toast.success('Message sent', { description: 'We\'ll get back to you soon.' })
      setName(''); setEmail(''); setSubject(''); setMessage('')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4 text-emerald-500" /> Contact &amp; Support</CardTitle>
        <CardDescription>Send us a message. Rate-limited to 3 per hour.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="contact-name">Name</Label>
            <Input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Your name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-email">Email</Label>
            <Input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} placeholder="you@example.com" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-subject">Subject</Label>
          <Input id="contact-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="How can we help?" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-message">Message</Label>
          <textarea
            id="contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={5000}
            placeholder="Describe your issue or question…"
            className="w-full min-h-[100px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {/* Honeypot field — hidden from real users, bots fill it */}
        <div className="hidden" aria-hidden="true">
          <label>Website (leave empty)<input type="text" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" /></label>
        </div>
        <Button onClick={handleSubmit} disabled={!name.trim() || !email.trim() || !subject.trim() || !message.trim() || sending} className="gap-2">
          {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send message
        </Button>
      </CardContent>
    </Card>
  )
}

'use client'

/**
 * useKeyboardShortcuts — global keyboard handler for StudentTemp power users.
 *
 * Supported shortcuts:
 *   g then i / m / a / c / s / ?  → navigate to Inbox / Messages / Addresses /
 *                                    Compose / Settings / About
 *   c                              → copy the active inbox email (if any)
 *   n                              → generate a new random inbox (if on Inbox)
 *   r                              → refresh messages (if on Messages)
 *   /                              → focus the message search box (if on Messages)
 *   j / k                          → navigate messages down / up (if on Messages)
 *   Enter                          → open the keyboard-selected message
 *   Cmd/Ctrl + k                   → open the command palette
 *   ?                              → show the keyboard shortcuts help dialog
 *   Escape                         → close the open message reader (and any
 *                                    cmdk/dialog surfaces that bubble Escape
 *                                    are handled natively by Radix)
 *
 * Shortcuts are suppressed when the user is typing in an input, textarea,
 * select, or contenteditable element (so we don't hijack their keystrokes).
 * The only shortcuts allowed while typing are Cmd/Ctrl+K (open palette) and
 * Escape (blur the field / close any dialog).
 *
 * Inter-section coordination (refresh messages, focus search, generate inbox)
 * is done via CustomEvents on `window` so the section components own their own
 * mutation logic. The hook itself stays presentational.
 */
import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

const TYPING_TAG = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function isTyping(el: Element | null): boolean {
  if (!el) return false
  if (TYPING_TAG.has(el.tagName)) return true
  // contenteditable="true" or contenteditable=""
  if (el.hasAttribute && el.hasAttribute('contenteditable')) return true
  // cmdk wraps its input in [cmdk-input] — also treat as typing
  if (el.closest && el.closest('[cmdk-input]')) return true
  return false
}

export function useKeyboardShortcuts() {
  const activeSection = useAppStore((s) => s.activeSection)
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const activeInboxId = useAppStore((s) => s.activeInboxId)
  const inboxes = useAppStore((s) => s.inboxes)
  const messages = useAppStore((s) => s.messages)
  const openMessageId = useAppStore((s) => s.openMessageId)
  const setOpenMessageId = useAppStore((s) => s.setOpenMessageId)
  const selectedMessageId = useAppStore((s) => s.selectedMessageId)
  const setSelectedMessageId = useAppStore((s) => s.setSelectedMessageId)
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)
  const setShortcutsDialogOpen = useAppStore((s) => s.setShortcutsDialogOpen)
  const setGlobalSearchOpen = useAppStore((s) => s.setGlobalSearchOpen)
  const isLocked = useAppStore((s) => s.isLocked)

  useEffect(() => {
    if (typeof window === 'undefined') return

    let gPrefix = false
    let gPrefixTimer: ReturnType<typeof setTimeout> | null = null

    const clearGPrefix = () => {
      gPrefix = false
      if (gPrefixTimer) {
        clearTimeout(gPrefixTimer)
        gPrefixTimer = null
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      // App-lock screen takes over while locked.
      if (isLocked) return

      const modK = e.metaKey || e.ctrlKey

      // Cmd/Ctrl+K always works (even from inside an input) so users can pop
      // the palette while their cursor is in a search field.
      if (modK && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        clearGPrefix()
        setCommandPaletteOpen(true)
        return
      }

      // Escape: handled natively by Radix dialogs/cmdk, but we also close the
      // open message reader (so users can dismiss it from anywhere).
      if (e.key === 'Escape') {
        if (openMessageId) {
          setOpenMessageId(null)
          e.preventDefault()
        }
        clearGPrefix()
        return
      }

      // Everything below is suppressed when typing in a form field.
      if (isTyping(document.activeElement)) {
        clearGPrefix()
        return
      }

      // Don't trigger on modifier-only presses or repeated holds.
      if (e.altKey || e.metaKey || e.ctrlKey) return

      const key = e.key

      // ---- g-prefix sequence ----
      if (gPrefix) {
        const navMap: Record<string, Parameters<typeof setActiveSection>[0]> = {
          i: 'inbox',
          m: 'messages',
          a: 'addresses',
          c: 'compose',
          s: 'settings',
          '?': 'about',
        }
        if (navMap[key] !== undefined || key === '/' || key === '?') {
          if (navMap[key]) {
            e.preventDefault()
            setActiveSection(navMap[key])
            if (navMap[key] === 'messages') setOpenMessageId(null)
          }
          clearGPrefix()
          return
        }
        // Unknown key after g — fall through to single-key handling, but first
        // clear the prefix so a stray 'g' doesn't get stuck.
        clearGPrefix()
      }

      // ---- single-key shortcuts ----
      switch (key) {
        case 'g': {
          // start the g-prefix window (700ms is enough for two-finger sequences)
          gPrefix = true
          if (gPrefixTimer) clearTimeout(gPrefixTimer)
          gPrefixTimer = setTimeout(() => {
            gPrefix = false
          }, 700)
          return
        }
        case 'c': {
          // copy the active inbox email
          const inbox = inboxes.find((i) => i.id === activeInboxId)
          if (!inbox) {
            toast.error('No active inbox to copy')
            return
          }
          e.preventDefault()
          navigator.clipboard
            .writeText(inbox.email)
            .then(() =>
              toast.success('Copied to clipboard', {
                description: inbox.email,
                duration: 1800,
              })
            )
            .catch(() => toast.error('Could not copy — please copy manually'))
          return
        }
        case 'n': {
          if (activeSection === 'inbox') {
            e.preventDefault()
            window.dispatchEvent(new CustomEvent('studenttemp:generate-inbox'))
          }
          return
        }
        case 'r': {
          if (activeSection === 'messages') {
            e.preventDefault()
            window.dispatchEvent(new CustomEvent('studenttemp:refresh-messages'))
          }
          return
        }
        case '/': {
          if (activeSection === 'messages') {
            e.preventDefault()
            window.dispatchEvent(new CustomEvent('studenttemp:focus-search'))
          }
          return
        }
        case 'j': {
          if (activeSection === 'messages') {
            e.preventDefault()
            const idx = messages.findIndex((m) => m.id === selectedMessageId)
            const next = idx < 0 ? messages[0] : messages[idx + 1]
            if (next) setSelectedMessageId(next.id)
          }
          return
        }
        case 'k': {
          if (activeSection === 'messages') {
            e.preventDefault()
            const idx = messages.findIndex((m) => m.id === selectedMessageId)
            if (idx > 0) {
              setSelectedMessageId(messages[idx - 1].id)
            }
          }
          return
        }
        case 'Enter': {
          if (activeSection === 'messages' && selectedMessageId) {
            e.preventDefault()
            setOpenMessageId(selectedMessageId)
          }
          return
        }
        case '?': {
          e.preventDefault()
          setShortcutsDialogOpen(true)
          return
        }
        case 'f': {
          // Forward the currently-open message (if any)
          if (activeSection === 'messages' && openMessageId) {
            e.preventDefault()
            window.dispatchEvent(new CustomEvent('studenttemp:forward-message', { detail: { id: openMessageId } }))
          }
          return
        }
        case 'S': {
          // Shift+S → global search across all inboxes
          e.preventDefault()
          setGlobalSearchOpen(true)
          return
        }
        default:
          return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (gPrefixTimer) clearTimeout(gPrefixTimer)
    }
  }, [
    activeSection,
    activeInboxId,
    inboxes,
    messages,
    openMessageId,
    selectedMessageId,
    setActiveSection,
    setOpenMessageId,
    setSelectedMessageId,
    setCommandPaletteOpen,
    setShortcutsDialogOpen,
    setGlobalSearchOpen,
    isLocked,
  ])
}

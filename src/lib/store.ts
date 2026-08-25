'use client'

import { create } from 'zustand'
import type { Inbox, MessageSummary } from '@/lib/types'

export type SectionId =
  | 'inbox' | 'messages' | 'addresses' | 'settings' | 'about'
  | 'legal' | 'applock' | 'expired' | 'onboarding' | 'compose' | 'sessions'
  | 'analytics'

interface AppState {
  // navigation
  activeSection: SectionId
  sectionParams: Record<string, string>
  setActiveSection: (s: SectionId, params?: Record<string, string>) => void

  // side drawer (mobile)
  drawerOpen: boolean
  setDrawerOpen: (v: boolean) => void

  // active inbox
  activeInboxId: string | null
  setActiveInboxId: (id: string | null) => void

  // inbox mirror for persistence (BUGFIX-INBOX-PERSISTENCE.md RC1/RC2)
  // Stored in localStorage (not sessionStorage) — survives tab close/reopen
  inboxMirror: { id: string; email: string; expiresAt: string } | null
  setInboxMirror: (m: { id: string; email: string; expiresAt: string } | null) => void

  // inboxes cache
  inboxes: Inbox[]
  setInboxes: (list: Inbox[]) => void
  upsertInbox: (inbox: Inbox) => void
  removeInbox: (id: string) => void
  updateInbox: (id: string, patch: Partial<Inbox>) => void

  // messages for the active inbox
  messages: MessageSummary[]
  setMessages: (list: MessageSummary[]) => void
  prependMessage: (msg: MessageSummary) => void
  updateMessage: (id: string, patch: Partial<MessageSummary>) => void
  removeMessage: (id: string) => void

  // the currently-open message in the reader
  openMessageId: string | null
  setOpenMessageId: (id: string | null) => void

  // recently arrived message id (for highlight animation)
  freshMessageId: string | null
  markFresh: (id: string) => void
  clearFresh: () => void

  // app lock
  isLocked: boolean
  setLocked: (v: boolean) => void
  appLockEnabled: boolean
  setAppLockEnabled: (v: boolean) => void

  // L2 (GAP-ANALYSIS-V2.md): pending deep-link navigation that arrives while
  // the app is locked. We store the target section + params; on successful
  // unlock, the LockScreen drains this and routes the user there. If the user
  // abandons the unlock, the pending target is discarded (per spec).
  pendingNavigation: { section: SectionId; params?: Record<string, string> } | null
  setPendingNavigation: (n: { section: SectionId; params?: Record<string, string> } | null) => void

  // onboarding (first-run)
  hasSeenOnboarding: boolean
  setHasSeenOnboarding: (v: boolean) => void

  // command palette + shortcuts help (driven by useKeyboardShortcuts)
  commandPaletteOpen: boolean
  setCommandPaletteOpen: (v: boolean) => void
  shortcutsDialogOpen: boolean
  setShortcutsDialogOpen: (v: boolean) => void

  // keyboard-driven message selection (j/k navigation in Messages section)
  selectedMessageId: string | null
  setSelectedMessageId: (id: string | null) => void

  // i18n locale (en | hi)
  locale: 'en' | 'hi' | 'ta' | 'bn' | 'te' | 'mr' | 'or'
  setLocale: (l: 'en' | 'hi' | 'ta' | 'bn' | 'te' | 'mr' | 'or') => void

  // web push notification pre-prompt (dismissed state)
  pushPromptDismissed: boolean
  setPushPromptDismissed: (v: boolean) => void

  // global search dialog
  globalSearchOpen: boolean
  setGlobalSearchOpen: (v: boolean) => void
}

const LS = {
  appLock: 'studenttemp_applock',
  onboarding: 'studenttemp_onboarded',
}

function readLS(key: string): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(key) === '1'
}
function writeLS(key: string, val: boolean) {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, val ? '1' : '0')
}

export const useAppStore = create<AppState>((set) => ({
  activeSection: 'inbox',
  sectionParams: {},
  setActiveSection: (s, params = {}) => set({ activeSection: s, sectionParams: params }),

  drawerOpen: false,
  setDrawerOpen: (v) => set({ drawerOpen: v }),

  activeInboxId: null,
  setActiveInboxId: (id) => {
    if (typeof window !== 'undefined' && id) {
      localStorage.setItem('studenttemp_active_inbox', id)
    } else if (typeof window !== 'undefined' && !id) {
      localStorage.removeItem('studenttemp_active_inbox')
      localStorage.removeItem('studenttemp_inbox_mirror')
    }
    set({ activeInboxId: id, openMessageId: null, messages: [], selectedMessageId: null })
  },

  inboxMirror: null,
  setInboxMirror: (m) => {
    if (typeof window !== 'undefined') {
      if (m) localStorage.setItem('studenttemp_inbox_mirror', JSON.stringify(m))
      else localStorage.removeItem('studenttemp_inbox_mirror')
    }
    set({ inboxMirror: m })
  },

  inboxes: [],
  setInboxes: (list) => set({ inboxes: list }),
  upsertInbox: (inbox) =>
    set((st) => {
      const idx = st.inboxes.findIndex((i) => i.id === inbox.id)
      if (idx === -1) return { inboxes: [inbox, ...st.inboxes] }
      const next = [...st.inboxes]
      next[idx] = inbox
      return { inboxes: next }
    }),
  removeInbox: (id) =>
    set((st) => ({
      inboxes: st.inboxes.filter((i) => i.id !== id),
      activeInboxId: st.activeInboxId === id ? null : st.activeInboxId,
      messages: st.activeInboxId === id ? [] : st.messages,
    })),
  updateInbox: (id, patch) =>
    set((st) => ({
      inboxes: st.inboxes.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    })),

  messages: [],
  setMessages: (list) => set({ messages: list }),
  prependMessage: (msg) =>
    set((st) => ({
      messages: [msg, ...st.messages.filter((m) => m.id !== msg.id)].slice(0, 100),
    })),
  updateMessage: (id, patch) =>
    set((st) => ({
      messages: st.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  removeMessage: (id) =>
    set((st) => ({
      messages: st.messages.filter((m) => m.id !== id),
      openMessageId: st.openMessageId === id ? null : st.openMessageId,
      selectedMessageId: st.selectedMessageId === id ? null : st.selectedMessageId,
    })),

  openMessageId: null,
  setOpenMessageId: (id) => set({ openMessageId: id }),

  freshMessageId: null,
  markFresh: (id) => set({ freshMessageId: id }),
  clearFresh: () => set({ freshMessageId: null }),

  isLocked: false,
  setLocked: (v) => set({ isLocked: v }),
  appLockEnabled: false,
  setAppLockEnabled: (v) => { writeLS(LS.appLock, v); set({ appLockEnabled: v }) },

  pendingNavigation: null,
  setPendingNavigation: (n) => set({ pendingNavigation: n }),

  hasSeenOnboarding: false,
  setHasSeenOnboarding: (v) => { writeLS(LS.onboarding, v); set({ hasSeenOnboarding: v }) },

  commandPaletteOpen: false,
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
  shortcutsDialogOpen: false,
  setShortcutsDialogOpen: (v) => set({ shortcutsDialogOpen: v }),

  selectedMessageId: null,
  setSelectedMessageId: (id) => set({ selectedMessageId: id }),

  locale: 'en',
  setLocale: (l) => {
    if (typeof window !== 'undefined') localStorage.setItem('studenttemp_locale', l)
    set({ locale: l })
  },

  pushPromptDismissed: false,
  setPushPromptDismissed: (v) => {
    if (typeof window !== 'undefined') writeLS('studenttemp_push_dismissed', v)
    set({ pushPromptDismissed: v })
  },

  globalSearchOpen: false,
  setGlobalSearchOpen: (v) => set({ globalSearchOpen: v }),
}))

// NOTE: localStorage hydration is done in a useEffect inside AppShell
// to avoid SSR hydration mismatch (server renders defaults, client updates after mount)

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
  locale: 'en' | 'hi' | 'ta' | 'bn'
  setLocale: (l: 'en' | 'hi' | 'ta' | 'bn') => void

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
  setActiveInboxId: (id) => set({ activeInboxId: id, openMessageId: null, messages: [], selectedMessageId: null }),

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

// Hydrate persisted UI flags on the client after mount (avoids SSR hydration mismatch).
if (typeof window !== 'undefined') {
  const appLock = readLS(LS.appLock)
  const onboarding = readLS(LS.onboarding)
  const locale = (localStorage.getItem('studenttemp_locale') as 'en' | 'hi' | 'ta' | 'bn') || 'en'
  const pushDismissed = readLS('studenttemp_push_dismissed')
  useAppStore.setState({
    appLockEnabled: appLock,
    hasSeenOnboarding: onboarding,
    locale,
    pushPromptDismissed: pushDismissed,
  })
  // Set <html lang> and dir attributes for accessibility + RTL
  document.documentElement.lang = locale
}

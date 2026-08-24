'use client'

import { create } from 'zustand'
import type { Inbox, MessageSummary } from '@/lib/types'

export type SectionId = 'inbox' | 'messages' | 'addresses' | 'settings' | 'about'

interface AppState {
  // navigation
  activeSection: SectionId
  setActiveSection: (s: SectionId) => void

  // active inbox (the one currently being watched)
  activeInboxId: string | null
  setActiveInboxId: (id: string | null) => void

  // inboxes cache (kept in sync with queries via setter)
  inboxes: Inbox[]
  setInboxes: (list: Inbox[]) => void
  upsertInbox: (inbox: Inbox) => void
  removeInbox: (id: string) => void
  updateInbox: (id: string, patch: Partial<Inbox>) => void

  // messages for the active inbox (real-time-updated)
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
}

export const useAppStore = create<AppState>((set) => ({
  activeSection: 'inbox',
  setActiveSection: (s) => set({ activeSection: s }),

  activeInboxId: null,
  setActiveInboxId: (id) => set({ activeInboxId: id, openMessageId: null, messages: [] }),

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
    })),

  openMessageId: null,
  setOpenMessageId: (id) => set({ openMessageId: id }),

  freshMessageId: null,
  markFresh: (id) => set({ freshMessageId: id }),
  clearFresh: () => set({ freshMessageId: null }),
}))

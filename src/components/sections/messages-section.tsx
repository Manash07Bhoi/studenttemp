'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  motion, AnimatePresence, useMotionValue, useTransform, useReducedMotion,
  useAnimationControls,
} from 'framer-motion'
import {
  Mail, MailOpen, Star, Trash2, ArrowLeft, ShieldCheck, ShieldAlert, Paperclip,
  Flag, ChevronRight, RefreshCw, Inbox as InboxIcon, Search, X,
  CheckCheck, Ban, AlertTriangle, Clock, Download, Reply, Send, MessagesSquare,
  ChevronsDownUp, CheckSquare, Check, Printer, ReplyAll, BellOff, Bell,
} from 'lucide-react'
import { api, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type { MessageSummary, MessageFull } from '@/lib/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { PullToRefresh } from '@/components/pull-to-refresh'
import { useLongPress } from '@/hooks/use-long-press'

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  otp: { label: 'OTP', color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' },
  registration: { label: 'Registration', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  newsletter: { label: 'Newsletter', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20' },
  social: { label: 'Social', color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20' },
  shopping: { label: 'Shopping', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  security: { label: 'Security', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
  general: { label: 'General', color: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20' },
}

function sanitizeHtml(html: string): string {
  if (!html) return '<p style="color:#999;font-family:Arial">(empty body)</p>'
  let out = html
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '')
  out = out.replace(/<style[\s\S]*?<\/style>/gi, '')
  out = out.replace(/\son\w+="[^"]*"/gi, '')
  out = out.replace(/\son\w+='[^']*'/gi, '')
  out = out.replace(/javascript:/gi, '')
  out = out.replace(/(<img[^>]+)src=["']https?:\/\/[^"']*["']/gi, '$1data-src-blocked="true"')
  out = out.replace(/<link[^>]+href=["']https?:\/\/[^"']*["'][^>]*>/gi, '')
  out = out.replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
  return `<base target="_blank"><style>body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;background:#fff;line-height:1.6;margin:0;padding:12px}a{color:#0ea5e9}img{max-width:100%;height:auto}</style>${out}`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function MessagesSection({ triggerGenerate: _triggerGenerate }: { triggerGenerate: (email: string) => void }) {
  const activeInboxId = useAppStore((s) => s.activeInboxId)
  const inboxes = useAppStore((s) => s.inboxes)
  const messages = useAppStore((s) => s.messages)
  const setMessages = useAppStore((s) => s.setMessages)
  const updateMessage = useAppStore((s) => s.updateMessage)
  const removeMessage = useAppStore((s) => s.removeMessage)
  const prependMessage = useAppStore((s) => s.prependMessage)
  const openMessageId = useAppStore((s) => s.openMessageId)
  const setOpenMessageId = useAppStore((s) => s.setOpenMessageId)
  const freshMessageId = useAppStore((s) => s.freshMessageId)
  const selectedMessageId = useAppStore((s) => s.selectedMessageId)
  const setSelectedMessageId = useAppStore((s) => s.setSelectedMessageId)
  // L1: handlers for transitioning to the Expired screen when the server
  // reports the active inbox has expired mid-request.
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const setActiveInboxId = useAppStore((s) => s.setActiveInboxId)
  const setInboxMirror = useAppStore((s) => s.setInboxMirror)
  const queryClient = useQueryClient()

  const activeInbox = inboxes.find((i) => i.id === activeInboxId)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [threadView, setThreadView] = useState(false)
  const [forwardingMsgId, setForwardingMsgId] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Search input ref — focused by the `/` keyboard shortcut.
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Mirror `openMessageId` into a ref so the undo-aware delete callback can
  // read the latest value without re-creating (lets us keep its deps list
  // narrow — only the stable setState functions).
  const openMessageIdRef = useRef<string | null>(openMessageId)
  useEffect(() => { openMessageIdRef.current = openMessageId }, [openMessageId])

  const { data: msgData, isFetching, refetch, error: msgQueryError } = useQuery({
    queryKey: ['messages', activeInboxId],
    queryFn: () => api.listMessages(activeInboxId!),
    enabled: !!activeInboxId,
    refetchInterval: 30_000,
    // L1: GAP-ANALYSIS-V2.md — when the inbox expires mid-request, the server
    // returns `{ code: 'INBOX_EXPIRED' }` with status 410 (not a generic 404/500).
    // On receiving this specific code, transition straight to the Expired screen
    // instead of showing a generic error+retry (a retry would be pointless — the
    // inbox is genuinely gone).
    retry: (failureCount, err) => {
      if (err instanceof ApiError && err.code === 'INBOX_EXPIRED') return false
      return failureCount < 3
    },
  })

  // L1: react to an INBOX_EXPIRED error code on the messages query and route
  // the user to the Expired screen — mirroring the socket-driven
  // `onInboxExpired` path in AppShell. We hold a "handled" ref keyed by inboxId
  // so we don't double-fire the transition if the effect re-runs.
  const inboxExpiredHandledRef = useRef<string | null>(null)
  useEffect(() => {
    if (!msgQueryError || !activeInboxId) return
    if (inboxExpiredHandledRef.current === activeInboxId) return
    if (msgQueryError instanceof ApiError && msgQueryError.code === 'INBOX_EXPIRED') {
      inboxExpiredHandledRef.current = activeInboxId
      const email = activeInbox?.email ?? ''
      // Tear down the local state for this inbox so a fresh start is required.
      setActiveInboxId(null)
      setInboxMirror(null)
      // Surface the expired section with the original email for context.
      setActiveSection('expired', { email })
      toast.warning('Inbox expired', {
        description: email ? `The inbox ${email} has expired.` : 'Your inbox has expired.',
        duration: 5000,
      })
      // Drop the errored query from cache so a future visit re-queries cleanly.
      queryClient.removeQueries({ queryKey: ['messages', activeInboxId] })
    }
  }, [msgQueryError, activeInboxId, activeInbox?.email, setActiveInboxId, setInboxMirror, setActiveSection, queryClient])

  useEffect(() => {
    if (msgData?.messages) {
      setMessages(msgData.messages)
    }
  }, [msgData, setMessages])

  // Keyboard-shortcut bridge: listen for global events dispatched by the
  // useKeyboardShortcuts hook (and the command palette).
  //   studenttemp:refresh-messages → re-run the messages query
  //   studenttemp:focus-search     → focus the search input
  useEffect(() => {
    const onRefresh = () => {
      refetch()
      toast.success('Messages refreshed', { duration: 1200 })
    }
    const onFocusSearch = () => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }
    const onForward = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail
      if (detail?.id) setForwardingMsgId(detail.id)
    }
    window.addEventListener('studenttemp:refresh-messages', onRefresh)
    window.addEventListener('studenttemp:focus-search', onFocusSearch)
    window.addEventListener('studenttemp:forward-message', onForward)
    return () => {
      window.removeEventListener('studenttemp:refresh-messages', onRefresh)
      window.removeEventListener('studenttemp:focus-search', onFocusSearch)
      window.removeEventListener('studenttemp:forward-message', onForward)
    }
  }, [refetch])

  // Auto-scroll the keyboard-selected message into view (j/k navigation).
  useEffect(() => {
    if (!selectedMessageId) return
    const el = document.querySelector<HTMLElement>(`[data-msg-id="${selectedMessageId}"]`)
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedMessageId])

  const filtered = messages.filter((m) => {
    if (filter === 'unread' && m.isRead) return false
    if (filter === 'starred' && !m.isStarred) return false
    if (categoryFilter !== 'all' && m.category !== categoryFilter) return false
    if (query) {
      const q = query.toLowerCase()
      return (
        m.subject.toLowerCase().includes(q) ||
        m.fromName.toLowerCase().includes(q) ||
        m.fromEmail.toLowerCase().includes(q) ||
        m.previewText.toLowerCase().includes(q)
      )
    }
    return true
  })

  // Thread view: group messages by normalized subject (strip Re:/Fwd: prefixes)
  const threads = useMemo(() => {
    if (!threadView) return null
    const normalizeSubject = (s: string) =>
      s.replace(/^(re:\s*|fwd:\s*)+/i, '').trim().toLowerCase()
    const groups = new Map<string, typeof filtered>()
    for (const m of filtered) {
      const key = normalizeSubject(m.subject)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(m)
    }
    // Sort each thread by receivedAt ascending (oldest first) and return as array
    return Array.from(groups.values()).map(thread =>
      thread.sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime())
    ).sort((a, b) => {
      // Sort threads by most recent message
      const aLast = new Date(a[a.length - 1].receivedAt).getTime()
      const bLast = new Date(b[b.length - 1].receivedAt).getTime()
      return bLast - aLast
    })
  }, [filtered, threadView])

  // G7 (GAP-ANALYSIS-V2.md): "Mute conversation" — archived + future messages
  // in that thread skip the Inbox (and don't trigger notifications). We store
  // muted thread subject hashes in localStorage so the mute survives tab close
  // and reload. Muting is reversible via the "Unmute" action.
  //
  // The mute is keyed by the same normalized subject used to group threads, so
  // it correctly matches both the message list and thread view. Account Mode
  // would additionally skip the new-message notification/badge for muted
  // threads — that requires server-side awareness (when Account Mode is
  // built, mirror mute state to the `threads` table so notifications can be
  // suppressed server-side too).
  const [mutedThreads, setMutedThreads] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const raw = localStorage.getItem('studenttemp_muted_threads')
      const arr = raw ? JSON.parse(raw) : []
      return new Set(Array.isArray(arr) ? arr : [])
    } catch {
      return new Set()
    }
  })
  const [showMuted, setShowMuted] = useState(false)

  const muteThread = useCallback((subject: string) => {
    const key = subject.replace(/^(re:\s*|fwd:\s*)+/i, '').trim().toLowerCase()
    if (!key) return
    setMutedThreads((prev) => {
      if (prev.has(key)) return prev
      const next = new Set(prev)
      next.add(key)
      try {
        localStorage.setItem('studenttemp_muted_threads', JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
    toast.success('Conversation muted', {
      description: 'Future messages in this thread will skip the Inbox.',
      duration: 3500,
    })
  }, [])

  const unmuteThread = useCallback((subject: string) => {
    const key = subject.replace(/^(re:\s*|fwd:\s*)+/i, '').trim().toLowerCase()
    if (!key) return
    setMutedThreads((prev) => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      try {
        localStorage.setItem('studenttemp_muted_threads', JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
    toast.success('Conversation unmuted')
  }, [])

  // Filter muted threads out of the visible list (unless "Show muted" is on).
  const visibleThreads = useMemo(() => {
    if (!threads) return null
    if (showMuted) return threads
    return threads.filter((thread) => {
      const key = thread[0].subject.replace(/^(re:\s*|fwd:\s*)+/i, '').trim().toLowerCase()
      return !mutedThreads.has(key)
    })
  }, [threads, showMuted, mutedThreads])

  // Also hide muted messages in the flat list view — when a thread is muted,
  // its individual messages are hidden from the Inbox entirely (matches Gmail).
  // The `filtered` memo is recomputed below; we apply the mute filter to the
  // message-level list too so the same mute state covers both views. When the
  // user opts to show muted conversations (`showMuted=true`), we skip the
  // filter so muted messages reappear in both the flat list and thread view.
  const listFiltered = useMemo(() => {
    if (mutedThreads.size === 0 || showMuted) return filtered
    return filtered.filter((m) => {
      const key = m.subject.replace(/^(re:\s*|fwd:\s*)+/i, '').trim().toLowerCase()
      return !mutedThreads.has(key)
    })
  }, [filtered, mutedThreads, showMuted])

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { isRead?: boolean; isStarred?: boolean } }) =>
      api.updateMessage(id, data),
    onSuccess: (_d, vars) => {
      updateMessage(vars.id, vars.data)
      queryClient.invalidateQueries({ queryKey: ['messages', activeInboxId] })
    },
  })

  // ----------------------------------------------------------------------------
  // Undo-aware delete: swipe-left commit + reader "Delete" button both route here.
  //
  // The flow per MOTION-SYSTEM §5.1:
  //   1. Optimistically remove the message from the store (zero-latency UI).
  //   2. Show an Undo snackbar with a shrinking progress bar (5s hold).
  //   3. If the user taps "Undo" within the window, re-insert the message
  //      and never call the API.
  //   4. Otherwise fire the real DELETE request after the snackbar dismisses.
  //   5. On API failure, re-insert the message and surface an error toast.
  // ----------------------------------------------------------------------------
  const pendingDeleteRef = useRef<Map<string, { msg: MessageSummary; timer: ReturnType<typeof setTimeout> }>>(new Map())

  const handleDeleteWithUndo = useCallback((msg: MessageSummary) => {
    // If the same message is already pending deletion, ignore duplicate calls.
    const existing = pendingDeleteRef.current.get(msg.id)
    if (existing) return

    // 1. Optimistic removal (also closes the reader if it was open).
    removeMessage(msg.id)
    if (openMessageIdRef.current === msg.id) {
      setOpenMessageId(null)
    }

    // 2. Schedule the real API delete for 5s from now.
    const timer = setTimeout(() => {
      pendingDeleteRef.current.delete(msg.id)
      api.deleteMessage(msg.id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['messages', activeInboxId] })
        })
        .catch(() => {
          // Restore the message if the server rejected the delete.
          prependMessage(msg)
          toast.error('Failed to delete message', {
            description: 'Restored to your inbox.',
          })
        })
    }, 5000)

    pendingDeleteRef.current.set(msg.id, { msg, timer })

    // 3. Show the snackbar with an Undo affordance.
    toast.custom(
      (t) => (
        <UndoSnackbar
          toastId={t}
          subject={msg.subject}
          onUndo={() => {
            const entry = pendingDeleteRef.current.get(msg.id)
            if (entry) {
              clearTimeout(entry.timer)
              pendingDeleteRef.current.delete(msg.id)
              // Re-insert at the top of the list (it was the most recently
              // interacted-with message, so visually that's where it belongs).
              prependMessage(msg)
            }
            toast.dismiss(t)
          }}
        />
      ),
      { duration: 5000, id: `undo-delete-${msg.id}` }
    )
  }, [removeMessage, setOpenMessageId, prependMessage, queryClient, activeInboxId])

  // ----------------------------------------------------------------------------
  // G11 (GAP-ANALYSIS-V2.md): Undo for mark-read / mark-unread and star/unstar
  // actions — mirrors the delete-undo pattern. State changes are applied
  // optimistically to the store; a 5s Undo window lets the user reverse them
  // before the API call fires. If the user taps Undo, we revert the local
  // state and never hit the server. If the API call fails after the window
  // closes, we revert and surface an error toast.
  //
  // The same `UndoSnackbar` shell is reused with a different icon + label
  // depending on the action (read/unread vs star/unstar).
  // ----------------------------------------------------------------------------
  type PendingStateChange = {
    msg: MessageSummary
    patch: { isRead?: boolean; isStarred?: boolean }
    timer: ReturnType<typeof setTimeout>
  }
  const pendingStateRef = useRef<Map<string, PendingStateChange>>(new Map())

  const fireStateChange = (msgId: string, patch: { isRead?: boolean; isStarred?: boolean }) => {
    api.updateMessage(msgId, patch)
      .then(() => queryClient.invalidateQueries({ queryKey: ['messages', activeInboxId] }))
      .catch(() => {
        // Revert the local state and surface an error toast.
        updateMessage(msgId, {
          isRead: patch.isRead !== undefined ? !patch.isRead : undefined,
          isStarred: patch.isStarred !== undefined ? !patch.isStarred : undefined,
        })
        toast.error('Failed to update message', {
          description: 'Your change was reverted.',
        })
      })
  }

  const handleStateChangeWithUndo = useCallback((
    msg: MessageSummary,
    patch: { isRead?: boolean; isStarred?: boolean },
    opts: { title: string; undoTitle: string; icon: 'read' | 'star'; idPrefix: string },
  ) => {
    // If there's already a pending state change for this message, commit it
    // immediately (no more undo) before starting the new one — otherwise the
    // previous change would be silently lost.
    const existing = pendingStateRef.current.get(msg.id)
    if (existing) {
      clearTimeout(existing.timer)
      pendingStateRef.current.delete(msg.id)
      fireStateChange(existing.msg.id, existing.patch)
    }

    // 1. Optimistic local state update.
    updateMessage(msg.id, patch)

    // 2. Schedule the real API call for 5s from now.
    const timer = setTimeout(() => {
      pendingStateRef.current.delete(msg.id)
      fireStateChange(msg.id, patch)
    }, 5000)

    pendingStateRef.current.set(msg.id, { msg, patch, timer })

    // 3. Show the snackbar with an Undo affordance.
    toast.custom(
      (t) => (
        <UndoSnackbar
          toastId={t}
          subject={msg.subject}
          icon={opts.icon}
          title={opts.title}
          onUndo={() => {
            const entry = pendingStateRef.current.get(msg.id)
            if (entry) {
              clearTimeout(entry.timer)
              pendingStateRef.current.delete(msg.id)
              // Revert the optimistic local state.
              updateMessage(msg.id, {
                isRead: entry.patch.isRead !== undefined ? !entry.patch.isRead : undefined,
                isStarred: entry.patch.isStarred !== undefined ? !entry.patch.isStarred : undefined,
              })
            }
            toast.dismiss(t)
          }}
        />
      ),
      { duration: 5000, id: `${opts.idPrefix}-${msg.id}` }
    )
  }, [updateMessage, queryClient, activeInboxId])

  // Read/unread undo wrapper. Toggling read can flow from swipe-right OR the
  // hover/context-menu "Mark read" / "Mark unread" actions.
  const handleToggleReadWithUndo = useCallback((msg: MessageSummary) => {
    handleStateChangeWithUndo(
      msg,
      { isRead: !msg.isRead },
      {
        title: msg.isRead ? 'Marked as unread' : 'Marked as read',
        undoTitle: 'Revert',
        icon: 'read',
        idPrefix: 'undo-read',
      },
    )
  }, [handleStateChangeWithUndo])

  // Star/unstar undo wrapper.
  const handleToggleStarWithUndo = useCallback((msg: MessageSummary) => {
    handleStateChangeWithUndo(
      msg,
      { isStarred: !msg.isStarred },
      {
        title: msg.isStarred ? 'Removed star' : 'Starred',
        undoTitle: 'Revert',
        icon: 'star',
        idPrefix: 'undo-star',
      },
    )
  }, [handleStateChangeWithUndo])

  const reportMutation = useMutation({
    mutationFn: ({ id, reason, category }: { id: string; reason: string; category: string }) =>
      api.reportMessage(id, reason, category),
    onSuccess: () => {
      toast.success('Message reported. Our team will review it.')
      queryClient.invalidateQueries({ queryKey: ['messages', activeInboxId] })
    },
  })

  // ---- Bulk actions ----
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAll = () => setSelectedIds(new Set(listFiltered.map(m => m.id)))
  const deselectAll = () => setSelectedIds(new Set())
  const bulkMarkRead = async () => {
    for (const id of selectedIds) {
      await api.updateMessage(id, { isRead: true }).catch(() => {})
    }
    queryClient.invalidateQueries({ queryKey: ['messages', activeInboxId] })
    toast.success(`Marked ${selectedIds.size} messages as read`)
    setSelectedIds(new Set())
    setSelectMode(false)
  }
  const bulkStar = async () => {
    for (const id of selectedIds) {
      await api.updateMessage(id, { isStarred: true }).catch(() => {})
    }
    queryClient.invalidateQueries({ queryKey: ['messages', activeInboxId] })
    toast.success(`Starred ${selectedIds.size} messages`)
    setSelectedIds(new Set())
    setSelectMode(false)
  }
  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} messages? This cannot be undone.`)) return
    for (const id of selectedIds) {
      await api.deleteMessage(id).catch(() => {})
      removeMessage(id)
    }
    queryClient.invalidateQueries({ queryKey: ['messages', activeInboxId] })
    toast.success(`Deleted ${selectedIds.size} messages`)
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  if (!activeInbox) {
    return (
      <EmptyState
        icon={<InboxIcon className="h-8 w-8" />}
        title="No active inbox"
        description="Generate an inbox on the Inbox tab to start receiving messages."
      />
    )
  }

  const openMsg = openMessageId ? messages.find((m) => m.id === openMessageId) : null

  return (
    <div className="space-y-4">
      {/* Header / toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Mail className="h-5 w-5 text-emerald-500" /> Messages
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground font-mono truncate">{activeInbox.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} /> Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="gap-1.5 capitalize">
                {filter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFilter('all')}>All messages</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('unread')}>Unread only</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('starred')}>Starred only</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-[130px] text-sm capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="otp">OTP</SelectItem>
              <SelectItem value="registration">Registration</SelectItem>
              <SelectItem value="newsletter">Newsletter</SelectItem>
              <SelectItem value="social">Social</SelectItem>
              <SelectItem value="shopping">Shopping</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={threadView ? 'default' : 'outline'}
            onClick={() => setThreadView(!threadView)}
            className="gap-1.5"
            title="Toggle thread view"
          >
            <MessagesSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Threads</span>
          </Button>
          {threadView && threads && threads.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('studenttemp:thread-toggle-all'))
              }}
              className="gap-1.5 text-xs"
              title="Expand/collapse all threads"
            >
              <ChevronsDownUp className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">All</span>
            </Button>
          )}
          {/* G7: Show/hide muted conversations. Hidden count badge surfaces
              when threads have been muted. */}
          {mutedThreads.size > 0 && (
            <Button
              size="sm"
              variant={showMuted ? 'default' : 'ghost'}
              onClick={() => setShowMuted((v) => !v)}
              className="gap-1.5 text-xs"
              title={showMuted ? 'Hide muted conversations' : 'Show muted conversations'}
            >
              {showMuted ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
              <span className="hidden lg:inline">{showMuted ? 'Hide muted' : `Muted (${mutedThreads.size})`}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subject, sender, or content…  (press / to focus)"
          className="pl-9"
        />
        {query ? (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center rounded border border-border/70 bg-muted px-1.5 font-mono text-[10px] tracking-wider text-muted-foreground">
            /
          </kbd>
        )}
      </div>

      {/* Message list + reader (split view on desktop, stacked on mobile) */}
      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-4">
        {/* List */}
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden order-1">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
            {selectMode ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary">
                  {selectedIds.size} selected
                </span>
                <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2" onClick={selectAll}>Select all</Button>
                <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2" onClick={deselectAll}>Clear</Button>
              </div>
            ) : (
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {listFiltered.length} {listFiltered.length === 1 ? 'message' : 'messages'}
              </span>
            )}
            <div className="flex items-center gap-1">
              {!selectMode ? (
                <>
                  {messages.filter((m) => !m.isRead).length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        messages.filter((m) => !m.isRead).forEach((m) =>
                          updateMutation.mutate({ id: m.id, data: { isRead: true } })
                        )
                      }}
                    >
                      <CheckCheck className="h-3 w-3" /> Mark all read
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1"
                    onClick={() => { setSelectMode(true); setSelectedIds(new Set()) }}
                    title="Select messages for bulk actions"
                  >
                    <CheckSquare className="h-3 w-3" /> Select
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}
                >
                  <X className="h-3 w-3" /> Exit
                </Button>
              )}
            </div>
          </div>
          {/* Bulk action bar */}
          <AnimatePresence>
            {selectMode && selectedIds.size > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-border/60 bg-emerald-500/5"
              >
                <div className="flex items-center gap-2 px-4 py-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={bulkMarkRead}>
                    <MailOpen className="h-3 w-3" /> Mark read
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={bulkStar}>
                    <Star className="h-3 w-3" /> Star
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-500 hover:bg-red-500/10" onClick={bulkDelete}>
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <ScrollArea className="h-[55vh] lg:h-[65vh] scrollbar-thin">
            <PullToRefresh onRefresh={async () => { await refetch() }}>
            {isFetching && messages.length === 0 ? (
              <div className="p-3 space-y-2 animate-stagger">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="rounded-lg p-3 border border-border/40">
                    <div className="flex gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted shimmer" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-2/3 rounded bg-muted shimmer" />
                        <div className="h-3 w-1/2 rounded bg-muted shimmer" />
                        <div className="h-2 w-full rounded bg-muted shimmer" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : listFiltered.length === 0 ? (
              <EmptyState
                icon={<Mail className="h-7 w-7" />}
                title={query || filter !== 'all' ? 'No matching messages' : (mutedThreads.size > 0 ? 'Inbox cleared' : 'No messages yet')}
                description={
                  query || filter !== 'all'
                    ? 'Try a different search or filter.'
                    : mutedThreads.size > 0
                      ? 'All visible messages are muted. Tap “Muted” above to reveal them.'
                      : 'New messages will appear here in real time as they arrive.'
                }
                compact
              />
            ) : threadView && visibleThreads ? (
              <div className="divide-y divide-border/40">
                {visibleThreads.map((thread, ti) => (
                  <ThreadGroup
                    key={ti}
                    thread={thread}
                    isMuted={mutedThreads.has(thread[0].subject.replace(/^(re:\s*|fwd:\s*)+/i, '').trim().toLowerCase())}
                    onMute={() => muteThread(thread[0].subject)}
                    onUnmute={() => unmuteThread(thread[0].subject)}
                  />
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                <AnimatePresence initial={false}>
                  {listFiltered.map((msg) => (
                    <MessageListItem
                      key={msg.id}
                      msg={msg}
                      active={openMessageId === msg.id}
                      selected={selectedMessageId === msg.id && openMessageId !== msg.id}
                      fresh={freshMessageId === msg.id}
                      selectMode={selectMode}
                      isSelected={selectedIds.has(msg.id)}
                      onToggleSelect={() => toggleSelect(msg.id)}
                      onOpen={() => {
                        if (selectMode) { toggleSelect(msg.id); return }
                        setOpenMessageId(msg.id)
                        setSelectedMessageId(msg.id)
                      }}
                      onToggleRead={() => handleToggleReadWithUndo(msg)}
                      onToggleStar={() => handleToggleStarWithUndo(msg)}
                      onDelete={() => handleDeleteWithUndo(msg)}
                      onReport={(reason, category) => reportMutation.mutate({ id: msg.id, reason, category })}
                      onForward={() => setForwardingMsgId(msg.id)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}
            </PullToRefresh>
          </ScrollArea>
        </div>

        {/* Reader */}
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden min-h-[55vh] lg:min-h-[65vh] order-2">
          <AnimatePresence mode="wait">
            {openMsg ? (
              <MessageReader
                key={openMsg.id}
                messageSummary={openMsg}
                onBack={() => setOpenMessageId(null)}
                onDelete={() => handleDeleteWithUndo(openMsg)}
                onToggleStar={() => handleToggleStarWithUndo(openMsg)}
                onReport={(reason, category) => reportMutation.mutate({ id: openMsg.id, reason, category })}
              />
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="grid place-items-center h-full min-h-[55vh] p-8"
              >
                <div className="text-center max-w-sm">
                  <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                    <MailOpen className="h-8 w-8" />
                  </div>
                  <h3 className="font-semibold">Select a message</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tap any message on the left to read it here. Messages render with external resources blocked for your safety.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Forward dialog */}
      <ForwardDialog
        messageId={forwardingMsgId}
        onOpenChange={(v) => { if (!v) setForwardingMsgId(null) }}
      />
    </div>
  )
}

// ---------------- Message List Item ----------------
// Swipe gestures per MOTION-SYSTEM.md §5.1:
//   • drag="x" with elastic constraints, card follows finger 1:1.
//   • swipe-left past 80 px (or 500 px/s velocity) → commit-delete:
//     card slides fully off-screen (200ms ease-in), then onDelete() fires
//     (which surfaces the Undo snackbar + collapses the row).
//   • swipe-right past 80 px (or 500 px/s velocity) → toggle read/unread,
//     card springs back to rest (no removal).
//   • background revealed underneath: red-500 with trash icon for delete,
//     emerald-500 with mail/mail-open icon swap for read/unread.
//   • icon scales up as |drag| grows.
//   • prefers-reduced-motion → drag disabled entirely; hover buttons still work.
//   • tap (no drag) → onOpen(). drag → suppress click.
function MessageListItem({
  msg, active, selected, fresh, selectMode, isSelected, onToggleSelect, onOpen, onToggleRead, onToggleStar, onDelete, onReport, onForward,
}: {
  msg: MessageSummary
  active: boolean
  selected: boolean
  fresh: boolean
  selectMode?: boolean
  isSelected?: boolean
  onToggleSelect?: () => void
  onOpen: () => void
  onToggleRead: () => void
  onToggleStar: () => void
  onDelete: () => void
  onReport: (reason: string, category: string) => void
  onForward?: () => void
}) {
  const cat = CATEGORY_META[msg.category] || CATEGORY_META.general
  const hasAuthIssue = msg.spf !== 'pass' || msg.dkim !== 'pass' || msg.dmarc !== 'pass'

  const reduceMotion = useReducedMotion()
  const dragX = useMotionValue(0)
  const controls = useAnimationControls()

  // Long-press context menu state
  const [showContextMenu, setShowContextMenu] = useState(false)
  const longPress = useLongPress({ onLongPress: () => setShowContextMenu(true) })

  // Track whether a real drag happened so we can suppress the click that
  // follows. Framer Motion fires `onClick` even after a drag ends if the
  // pointer-up happens over the same element; we want a tap (no movement) to
  // open the message, and a drag to NOT open it.
  const draggedRef = useRef(false)
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null)

  // ---- drag x → background opacity + icon scale mappings ----
  // Delete background: 0 at rest → 1 when dragged to -120px.
  const deleteBgOpacity = useTransform(dragX, [-120, -40], [1, 0], { clamp: true })
  // Read/unread background: 0 at rest → 1 when dragged to +120px.
  const readBgOpacity = useTransform(dragX, [40, 120], [0, 1], { clamp: true })
  // Trash icon scales from 0.8 → 1.4 as the user swipes left past the threshold.
  const deleteIconScale = useTransform(dragX, [-120, -40], [1.4, 0.8], { clamp: true })
  // Mail icon scales from 0.8 → 1.4 as the user swipes right past the threshold.
  const readIconScale = useTransform(dragX, [40, 120], [0.8, 1.4], { clamp: true })

  const COMMIT_THRESHOLD = 80 // px
  const VELOCITY_THRESHOLD = 500 // px/s

  const handleDragEnd = async (_e: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    // Clear the drag flag (the click that fires right after will check it).
    // Defer clearing by a tick so the click event sees `draggedRef = true`.
    setTimeout(() => { draggedRef.current = false }, 0)

    const offset = info.offset.x
    const velocity = info.velocity.x

    if (offset < -COMMIT_THRESHOLD || velocity < -VELOCITY_THRESHOLD) {
      // Swipe left → delete.
      // Slide the card fully off-screen (200ms ease-in per spec), then call
      // onDelete() which optimistically removes the message from the store
      // and triggers the row's exit-animation (height → 0).
      await controls.start({
        x: '-120%',
        opacity: 0,
        transition: { duration: 0.2, ease: 'easeIn' },
      })
      onDelete()
      // The parent <motion.li> unmounts (because removeMessage removes the
      // message from the store), so we don't need to reset dragX/controls here.
    } else if (offset > COMMIT_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      // Swipe right → toggle read/unread, then spring back to rest.
      onToggleRead()
      await controls.start({
        x: 0,
        transition: { type: 'spring', stiffness: 500, damping: 30 },
      })
    } else {
      // Spring back to rest (no commit).
      await controls.start({
        x: 0,
        transition: { type: 'spring', stiffness: 500, damping: 30 },
      })
    }
  }

  const handleClick = () => {
    if (draggedRef.current) return
    // Suppress click after a long-press (the context menu opened)
    if (longPress.didLongPress.current) {
      return
    }
    onOpen()
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    pointerDownRef.current = { x: e.clientX, y: e.clientY }
  }
  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    // If the pointer moved less than ~5 px since pointer-down, this was a tap,
    // not a drag. Framer Motion will fire onClick naturally; we just need to
    // make sure `draggedRef` reflects the truth.
    const down = pointerDownRef.current
    pointerDownRef.current = null
    if (down) {
      const dx = Math.abs(e.clientX - down.x)
      const dy = Math.abs(e.clientY - down.y)
      if (dx < 5 && dy < 5) {
        draggedRef.current = false
      }
    }
  }

  return (
    <motion.li
      layout
      data-msg-id={msg.id}
      initial={fresh ? { opacity: 0, y: -16 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="relative overflow-hidden"
    >
      {/* ---- Swipe action backgrounds (revealed underneath the card) ---- */}
      {/* Delete (left swipe) */}
      <div
        className="absolute inset-0 bg-red-500 flex items-center justify-start pl-6 pointer-events-none"
        aria-hidden="true"
      >
        <motion.div
          style={{ opacity: deleteBgOpacity, scale: deleteIconScale }}
          className="flex flex-col items-center gap-1 text-white"
        >
          <Trash2 className="h-5 w-5" />
          <span className="text-[10px] font-semibold uppercase tracking-wide">Delete</span>
        </motion.div>
      </div>
      {/* Read/unread (right swipe) */}
      <div
        className="absolute inset-0 bg-emerald-500 flex items-center justify-end pr-6 pointer-events-none"
        aria-hidden="true"
      >
        <motion.div
          style={{ opacity: readBgOpacity, scale: readIconScale }}
          className="flex flex-col items-center gap-1 text-white"
        >
          {msg.isRead ? <Mail className="h-5 w-5" /> : <MailOpen className="h-5 w-5" />}
          <span className="text-[10px] font-semibold uppercase tracking-wide">
            {msg.isRead ? 'Unread' : 'Read'}
          </span>
        </motion.div>
      </div>

      {/* ---- Draggable card ---- */}
      <motion.div
        drag={reduceMotion ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        dragMomentum={false}
        style={{ x: dragX }}
        animate={controls}
        onDragStart={() => { draggedRef.current = true }}
        onDragEnd={handleDragEnd}
        whileDrag={{ cursor: 'grabbing' }}
        className={cn(
          'relative group cursor-pointer bg-card transition-colors touch-pan-y',
          active
            ? 'bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/50 shadow-sm'
            : selected
              ? 'bg-emerald-500/8 ring-1 ring-inset ring-emerald-500/30'
              : 'hover:bg-accent/40',
          isSelected && 'bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/40',
          fresh && 'bg-emerald-500/5'
        )}
      >
        <button
          onClick={handleClick}
          onPointerDown={(e) => { handlePointerDown(e); longPress.bind.onPointerDown(e) }}
          onPointerMove={longPress.bind.onPointerMove}
          onPointerUp={(e) => { handlePointerUp(e); longPress.bind.onPointerUp(e) }}
          onPointerLeave={longPress.bind.onPointerLeave}
          onPointerCancel={longPress.bind.onPointerCancel}
          style={longPress.isLongPressing ? { transform: 'scale(0.98)', transition: 'transform 0.15s ease' } : undefined}
          className="w-full text-left p-3 flex gap-3 min-w-0"
          aria-label={`Open message: ${msg.subject} from ${msg.fromName}`}
          aria-haspopup={showContextMenu ? 'menu' : undefined}
          aria-expanded={showContextMenu}
        >
          {selectMode && (
            <div
              className={cn(
                'grid h-5 w-5 shrink-0 place-items-center rounded border-2 transition-colors mt-2.5',
                isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/30'
              )}
              onClick={(e) => { e.stopPropagation(); onToggleSelect?.() }}
            >
              {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
            </div>
          )}
          <div className="relative shrink-0">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 text-white font-bold text-sm">
              {msg.fromName[0]?.toUpperCase() || '?'}
            </div>
            {!msg.isRead && (
              <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
            )}
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <span className={cn('text-sm truncate min-w-0', msg.isRead ? 'font-medium text-foreground' : 'font-bold text-foreground')}>
                {msg.fromName}
              </span>
              <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                {formatTime(msg.receivedAt)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
              <span className={cn('text-sm truncate flex-1 min-w-0', msg.isRead ? 'text-foreground/70' : 'text-foreground font-semibold')}>
                {msg.subject}
              </span>
              {msg.isStarred && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />}
              {msg.hasAttachment && <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              {hasAuthIssue && <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground truncate min-w-0">{msg.previewText}</p>
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4', cat.color)}>{cat.label}</Badge>
              {msg.scanStatus === 'quarantined' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-red-500/10 text-red-600 border-red-500/20">
                  <Ban className="h-2.5 w-2.5 mr-0.5" /> Quarantined
                </Badge>
              )}
              {msg.externalResourcesBlocked > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-500/20">
                  <Ban className="h-2.5 w-2.5 mr-0.5" /> {msg.externalResourcesBlocked} blocked
                </Badge>
              )}
            </div>
          </div>
        </button>

        {/* Hover quick actions — preserved unchanged */}
        <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-0.5 bg-background/90 backdrop-blur rounded-lg border border-border/60 p-0.5 shadow-sm">
          <button onClick={(e) => { e.stopPropagation(); onToggleStar() }} title={msg.isStarred ? 'Unstar' : 'Star'} className="grid h-7 w-7 place-items-center rounded hover:bg-accent">
            <Star className={cn('h-3.5 w-3.5', msg.isStarred && 'text-amber-500 fill-amber-500')} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onToggleRead() }} title={msg.isRead ? 'Mark unread' : 'Mark read'} className="grid h-7 w-7 place-items-center rounded hover:bg-accent">
            {msg.isRead ? <Mail className="h-3.5 w-3.5" /> : <MailOpen className="h-3.5 w-3.5" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete() }} title="Delete" className="grid h-7 w-7 place-items-center rounded hover:bg-red-500/10 text-red-500">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button onClick={(e) => e.stopPropagation()} title="More" className="grid h-7 w-7 place-items-center rounded hover:bg-accent">
                <ChevronRight className="h-3.5 w-3.5 rotate-90" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onReport('Spam or promotional abuse', 'spam')} className="gap-2 text-red-600">
                <Flag className="h-3.5 w-3.5" /> Report as spam
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onReport('Phishing or fraud attempt', 'phishing')} className="gap-2 text-red-600">
                <Flag className="h-3.5 w-3.5" /> Report phishing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onReport('Other', 'other')} className="gap-2 text-red-600">
                <Flag className="h-3.5 w-3.5" /> Report (other)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Long-press context menu (MOTION-SYSTEM.md §17) */}
        <AnimatePresence>
          {showContextMenu && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowContextMenu(false)}
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-xs rounded-2xl border border-border/60 bg-card p-1.5 shadow-2xl"
                role="menu"
                aria-label="Message actions"
              >
                <div className="px-3 py-2 border-b border-border/40 mb-1">
                  <p className="text-xs font-medium truncate">{msg.subject}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{msg.fromName}</p>
                </div>
                <button
                  onClick={() => { onToggleRead(); setShowContextMenu(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent text-sm text-left"
                  role="menuitem"
                >
                  {msg.isRead ? <Mail className="h-4 w-4 text-muted-foreground" /> : <MailOpen className="h-4 w-4 text-emerald-500" />}
                  {msg.isRead ? 'Mark as unread' : 'Mark as read'}
                </button>
                <button
                  onClick={() => { onToggleStar(); setShowContextMenu(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent text-sm text-left"
                  role="menuitem"
                >
                  <Star className={cn('h-4 w-4', msg.isStarred ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground')} />
                  {msg.isStarred ? 'Unstar' : 'Star'}
                </button>
                {onForward && (
                  <button
                    onClick={() => { onForward(); setShowContextMenu(false) }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent text-sm text-left"
                    role="menuitem"
                  >
                    <Send className="h-4 w-4 text-emerald-500" />
                    Forward
                  </button>
                )}
                <button
                  onClick={() => { window.open(`/api/messages/${msg.id}/export`, '_blank'); setShowContextMenu(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent text-sm text-left"
                  role="menuitem"
                >
                  <Download className="h-4 w-4 text-muted-foreground" />
                  Export as .eml
                </button>
                <div className="h-px bg-border/40 my-1" />
                <button
                  onClick={() => { onDelete(); setShowContextMenu(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-500/10 text-sm text-red-600 text-left"
                  role="menuitem"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
                <button
                  onClick={() => { onReport('Reported via context menu', 'other'); setShowContextMenu(false) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-500/10 text-sm text-red-600 text-left"
                  role="menuitem"
                >
                  <Flag className="h-4 w-4" />
                  Report
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.li>
  )
}

// ---------------- Undo Snackbar (custom sonner toast) ----------------
// Per MOTION-SYSTEM.md §5.1: slides up from bottom, holds 5s with a shrinking
// progress bar, tapping "Undo" re-inserts the deleted message.
//
// G11 (GAP-ANALYSIS-V2.md): the same shell is reused for mark-read / star
// undo by passing a different `icon` ('delete' | 'read' | 'star') and `title`.
function UndoSnackbar({
  toastId,
  subject,
  onUndo,
  icon = 'delete',
  title,
}: {
  toastId: string | number
  subject: string
  onUndo: () => void
  icon?: 'delete' | 'read' | 'star'
  title?: string
}) {
  const [progress, setProgress] = useState(100)
  useEffect(() => {
    const DURATION = 5000
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const elapsed = now - start
      const remaining = Math.max(0, DURATION - elapsed)
      setProgress((remaining / DURATION) * 100)
      if (remaining > 0) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const meta = icon === 'delete'
    ? { Icon: Trash2, badge: 'bg-red-500/20 text-red-300', label: title ?? 'Message deleted', accent: 'text-red-300', ariaLabel: 'Undo delete' }
    : icon === 'star'
      ? { Icon: Star, badge: 'bg-amber-500/20 text-amber-300', label: title ?? 'Starred', accent: 'text-amber-300', ariaLabel: 'Undo star' }
      : { Icon: MailOpen, badge: 'bg-emerald-500/20 text-emerald-300', label: title ?? 'Marked as read', accent: 'text-emerald-300', ariaLabel: 'Undo mark-read' }
  const { Icon, badge, label, ariaLabel } = meta

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.8 }}
      className="relative flex items-center gap-3 rounded-xl border border-border/60 bg-zinc-900 text-white px-4 py-3 shadow-xl min-w-[300px] max-w-[420px] overflow-hidden"
      role="alert"
      aria-live="assertive"
    >
      <span className={cn('grid h-8 w-8 place-items-center rounded-full shrink-0', badge)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-zinc-300 truncate">{subject}</div>
      </div>
      <button
        onClick={onUndo}
        className="text-sm font-semibold text-emerald-300 hover:text-emerald-200 px-2 py-1 rounded-md hover:bg-white/5 transition-colors shrink-0"
        aria-label={ariaLabel}
      >
        Undo
      </button>
      {/* Shrinking progress bar (5s countdown). */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400/80" style={{ width: `${progress}%` }} aria-hidden="true" />
      {/* Hidden button to allow Escape to dismiss (sonner handles this anyway
          when focus is on the toast; this is a defensive belt-and-braces). */}
      <span className="sr-only" data-toast-id={toastId} />
    </motion.div>
  )
}

// ---------------- Message Reader ----------------
function MessageReader({
  messageSummary, onBack, onDelete, onToggleStar, onReport,
}: {
  messageSummary: MessageSummary
  onBack: () => void
  onDelete: () => void
  onToggleStar: () => void
  onReport: (reason: string, category: string) => void
}) {
  const [full, setFull] = useState<MessageFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRaw, setShowRaw] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [showReply, setShowReply] = useState(false)
  // G2: Reply All — 'sender' = reply to original sender only; 'all' = reply to
  // sender + additional Cc recipients the user adds. The dialog opens in the
  // matching mode depending on which menu item the user tapped.
  const [replyMode, setReplyMode] = useState<'sender' | 'all'>('sender')
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true
    setLoading(true)
    setFull(null)
    setImagesLoaded(false)
    api.getMessage(messageSummary.id).then((data) => {
      if (active) {
        setFull(data.message)
        setLoading(false)
      }
    }).catch(() => setLoading(false))
    return () => { active = false }
  }, [messageSummary.id])

  const cat = CATEGORY_META[messageSummary.category] || CATEGORY_META.general
  const authFail = messageSummary.spf !== 'pass' || messageSummary.dkim !== 'pass' || messageSummary.dmarc !== 'pass'
  const spoofed = messageSummary.fromName !== messageSummary.fromEmail &&
    /paypal|bank|secure|verify|official|government|google|microsoft|apple|amazon|facebook/i.test(messageSummary.fromName)
  // H5: Detect punycode domains (IDN homograph attacks)
  const hasPunycode = /xn--/i.test(messageSummary.fromEmail)
  // Detect display name that doesn't match the domain in the email address
  const senderDomain = messageSummary.fromEmail.split('@')[1] || ''
  const displayNameLooksLikeDomain = /\.[a-z]{2,}$/i.test(messageSummary.fromName) &&
    messageSummary.fromName !== senderDomain
  // G10: Spam warning — if scanStatus is 'quarantined' or auth fails + urgency keywords
  const isQuarantined = messageSummary.scanStatus === 'quarantined'
  const isSuspicious = !isQuarantined && authFail && /urgent|verify|suspended|account|confirm|click here|limited time/i.test(messageSummary.subject + ' ' + messageSummary.previewText)
  // G8: Importance marker — if sender is NOT a known bulk/noreply pattern + direct To: (not bulk)
  const isImportant = !isQuarantined && !authFail &&
    !/noreply|no-reply|donotreply|newsletter|notification|alert|automated/i.test(messageSummary.fromEmail) &&
    !/unsubscribe|list-id|precedence:\s*bulk/i.test(messageSummary.previewText)

  const sanitizedHtml = useMemo(() => {
    if (!full?.bodyHtml) return ''
    let out = full.bodyHtml
    if (imagesLoaded) {
      // restore blocked image srcs
      out = out.replace(/(<img[^>]+)data-src-blocked=["']true["']/gi, '$1')
    } else {
      out = out.replace(/(<img[^>]+)src=["']https?:\/\/[^"']*["']/gi, '$1data-src-blocked="true"')
    }
    return sanitizeHtml(out)
  }, [full?.bodyHtml, imagesLoaded])

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full min-h-[55vh] lg:min-h-[65vh]"
    >
      {/* Reader header */}
      <div className="border-b border-border/60 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 lg:hidden">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleStar} title={messageSummary.isStarred ? 'Unstar' : 'Star'}>
            <Star className={cn('h-4 w-4', messageSummary.isStarred && 'text-amber-500 fill-amber-500')} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-500/10" onClick={() => setShowReply(true)} title="Reply">
            <Reply className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-500/10" onClick={onDelete} title="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="More">
                <ChevronRight className="h-4 w-4 rotate-90" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowAuth(!showAuth)} className="gap-2">
                <ShieldCheck className="h-3.5 w-3.5" /> {showAuth ? 'Hide' : 'Show'} security panel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowRaw(!showRaw)} className="gap-2">
                <Mail className="h-3.5 w-3.5" /> {showRaw ? 'HTML view' : 'Plain text view'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setReplyMode('sender'); setShowReply(true) }} className="gap-2">
                <Reply className="h-3.5 w-3.5" /> Reply to sender
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setReplyMode('all'); setShowReply(true) }} className="gap-2">
                <ReplyAll className="h-3.5 w-3.5" /> Reply to all
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  // Dispatch a custom event the parent MessagesSection listens for
                  window.dispatchEvent(new CustomEvent('studenttemp:forward-message', { detail: { id: messageSummary.id } }))
                }}
                className="gap-2"
              >
                <Send className="h-3.5 w-3.5" /> Forward message
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  window.open(`/api/messages/${messageSummary.id}/export`, '_blank')
                  toast.success('Exporting as .eml…')
                }}
                className="gap-2"
              >
                <Download className="h-3.5 w-3.5" /> Export as .eml
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => window.print()}
                className="gap-2"
              >
                <Printer className="h-3.5 w-3.5" /> Print message
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowReport(true)} className="gap-2 text-red-600">
                <Flag className="h-3.5 w-3.5" /> Report this message
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h2 className="text-lg font-bold leading-tight">{messageSummary.subject}</h2>

        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 text-white font-bold text-sm">
            {messageSummary.fromName[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{messageSummary.fromName}</span>
              {spoofed && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" /> Display name looks suspicious
                </Badge>
              )}
              {hasPunycode && (
                <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px] gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" /> IDN domain (possible spoof)
                </Badge>
              )}
              {displayNameLooksLikeDomain && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" /> Name mimics a domain
                </Badge>
              )}
              <Badge variant="outline" className={cn('text-[10px]', cat.color)}>{cat.label}</Badge>
              {isImportant && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" /> Important
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground font-mono break-all">&lt;{messageSummary.fromEmail}&gt;</p>
            <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> {new Date(messageSummary.receivedAt).toLocaleString()}
            </p>
            {(spoofed || hasPunycode || displayNameLooksLikeDomain) && (
              <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                <span>Authentication checks confirm the sending server's identity — they do not guarantee the message content is safe. Always verify the sender's real address above.</span>
              </p>
            )}
          </div>
        </div>

        {/* Auth panel */}
        <AnimatePresence>
          {showAuth && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-3 gap-2 pt-2">
                <AuthChip label="SPF" value={messageSummary.spf} />
                <AuthChip label="DKIM" value={messageSummary.dkim} />
                <AuthChip label="DMARC" value={messageSummary.dmarc} />
              </div>
              {authFail && (
                <div className="mt-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-700 dark:text-amber-300 flex gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>One or more authentication checks failed. Be cautious — the sender's identity could not be fully verified.</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Attachments */}
        {full && full.attachments && full.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {full.attachments.map((a, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{a.name}</span>
                <span className="text-muted-foreground">{(a.size / 1024).toFixed(0)} KB</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* G10: Spam warning banner — borderline suspicious */}
      {isSuspicious && (
        <div className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>This message looks suspicious — authentication checks failed and urgency keywords detected.</span>
        </div>
      )}
      {/* G10: Quarantined banner */}
      {isQuarantined && (
        <div className="border-b border-red-500/20 bg-red-500/5 px-4 py-2.5 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <Ban className="h-4 w-4 shrink-0" />
          <span>This message was flagged by spam detection and quarantined. Exercise caution.</span>
        </div>
      )}

      {/* External resources blocked banner */}
      {messageSummary.externalResourcesBlocked > 0 && !imagesLoaded && (
        <motion.div
          initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-2.5 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300"
        >
          <Ban className="h-4 w-4 shrink-0" />
          <span className="flex-1">{messageSummary.externalResourcesBlocked} external resource{messageSummary.externalResourcesBlocked !== 1 ? 's' : ''} blocked for your safety.</span>
          <button
            onClick={() => setImagesLoaded(true)}
            className="font-medium underline-offset-2 hover:underline"
          >
            Load anyway
          </button>
        </motion.div>
      )}

      {/* Body */}
      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="p-4">
          {loading ? (
            <div className="space-y-3 animate-stagger">
              <div className="h-4 w-3/4 rounded bg-muted shimmer" />
              <div className="h-4 w-full rounded bg-muted shimmer" />
              <div className="h-4 w-5/6 rounded bg-muted shimmer" />
              <div className="h-24 w-full rounded-lg bg-muted shimmer" />
              <div className="h-4 w-2/3 rounded bg-muted shimmer" />
            </div>
          ) : showRaw ? (
            <pre className="whitespace-pre-wrap break-words text-sm font-mono text-foreground/80">
              {full?.bodyText}
            </pre>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <iframe
                title="message body"
                srcDoc={sanitizedHtml}
                className="w-full min-h-[300px] border-0"
                sandbox="allow-same-origin allow-popups"
                ref={(el) => {
                  // Attach external link interstitial handler
                  if (el && el.contentWindow) {
                    el.contentWindow.onclick = (e) => {
                      const target = (e.target as HTMLElement).closest('a')
                      if (target && target.href) {
                        e.preventDefault()
                        const url = target.href
                        const domain = (() => { try { return new URL(url).hostname } catch { return url } })()
                        if (confirm(`You're leaving StudentTemp to visit ${domain}.\n\nDo you want to continue to ${url}?`)) {
                          window.open(url, '_blank', 'noopener,noreferrer')
                        }
                      }
                    }
                  }
                }}
              />
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Report dialog */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Flag className="h-4 w-4 text-red-500" /> Report this message</DialogTitle>
            <DialogDescription>
              Flag this message for review. The sender is not notified.
            </DialogDescription>
          </DialogHeader>
          <ReportForm onSubmit={(reason, category) => { onReport(reason, category); setShowReport(false) }} />
        </DialogContent>
      </Dialog>

      <ReplyDialog
        open={showReply}
        onOpenChange={setShowReply}
        messageId={messageSummary.id}
        to={messageSummary.fromEmail}
        toName={messageSummary.fromName}
        subject={messageSummary.subject}
        replyAll={replyMode === 'all'}
      />
    </motion.div>
  )
}

function ReportForm({ onSubmit }: { onSubmit: (reason: string, category: string) => void }) {
  const [category, setCategory] = useState('spam')
  const [reason, setReason] = useState('')
  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-2">
        {[
          { v: 'spam', l: 'Spam / Promo' },
          { v: 'phishing', l: 'Phishing / Fraud' },
          { v: 'abuse', l: 'Abuse / Harassment' },
          { v: 'other', l: 'Other' },
        ].map((o) => (
          <button
            key={o.v}
            onClick={() => setCategory(o.v)}
            className={cn(
              'rounded-lg border px-3 py-2 text-sm font-medium transition-colors text-left',
              category === o.v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'
            )}
          >
            {o.l}
          </button>
        ))}
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Add details (optional)..."
        className="w-full min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <DialogFooter>
        <Button onClick={() => onSubmit(reason, category)} className="gap-2">
          <Flag className="h-4 w-4" /> Submit report
        </Button>
      </DialogFooter>
    </div>
  )
}

function AuthChip({ label, value }: { label: string; value: string }) {
  const pass = value === 'pass'
  const warn = value === 'softfail' || value === 'none'
  return (
    <div className={cn(
      'rounded-lg border p-2 text-center',
      pass && 'bg-emerald-500/10 border-emerald-500/20',
      warn && 'bg-amber-500/10 border-amber-500/20',
      !pass && !warn && 'bg-red-500/10 border-red-500/20',
    )}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn(
        'text-sm font-bold flex items-center justify-center gap-1',
        pass && 'text-emerald-600 dark:text-emerald-400',
        warn && 'text-amber-600 dark:text-amber-400',
        !pass && !warn && 'text-red-600 dark:text-red-400',
      )}>
        {pass ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
        {value}
      </div>
    </div>
  )
}

function EmptyState({ icon, title, description, compact }: { icon: React.ReactNode; title: string; description: string; compact?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn('flex flex-col items-center justify-center text-center', compact ? 'p-8' : 'p-12')}
    >
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500 animate-float">{icon}</div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground leading-relaxed">{description}</p>
    </motion.div>
  )
}

// ---------- Reply Dialog ----------
// G2 (GAP-ANALYSIS-V2.md): supports two modes —
//   • replyAll=false → "Reply to sender": To = original sender only.
//   • replyAll=true  → "Reply to all": To = original sender, plus a Cc field
//     that the user can pre-fill with additional recipients (and a note that
//     replies will be sent to all known recipients).
//
// The Cc field is intentionally a free-text comma-separated list — the
// temporary-inbox model doesn't store the original To/Cc recipient list of
// inbound mail (only the sender), so we expose the input for the user to add
// the other participants manually. In a future Account Mode, the original
// To/Cc headers would be parsed and pre-filled here automatically.
//
// G9 (GAP-ANALYSIS-V2.md, Account Mode note): when this code is repurposed for
// Account Mode, the "From" field on the reply should default to whichever
// alias the original message was delivered to (not the primary address), and
// the signature auto-inserted should match the alias's configured signature.
// This logic is documented here for the future Account Mode migration; it is
// intentionally not wired in Temporary Mode (which has no aliases).
function ReplyDialog({
  open, onOpenChange, messageId, to, toName, subject, replyAll,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  messageId: string
  to: string
  toName: string
  subject: string
  replyAll?: boolean
}) {
  const [body, setBody] = useState('')
  const [cc, setCc] = useState('')
  const mutation = useMutation({
    mutationFn: (vars: { text: string; cc?: string }) =>
      fetch(`/api/messages/${messageId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: vars.text, cc: vars.cc }),
      }).then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || 'Reply failed')
        return data
      }),
    onSuccess: (data) => {
      toast.success(replyAll ? 'Reply sent to all recipients' : 'Reply sent', {
        description: data.to === to
          ? `Delivered to ${to}${cc.trim() ? ' + Cc' : ''}`
          : `Delivered to ${data.to}`,
        duration: 3000,
      })
      setBody('')
      setCc('')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const replySubject = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {replyAll
              ? <><ReplyAll className="h-4 w-4 text-emerald-500" /> Reply to all</>
              : <><Reply className="h-4 w-4 text-emerald-500" /> Reply to sender</>}
          </DialogTitle>
          <DialogDescription>
            {replyAll
              ? <>Your reply will be sent via real SMTP to <span className="font-mono font-medium">{to}</span> and any Cc recipients you add below.</>
              : <>Your reply will be sent via real SMTP from your inbox to <span className="font-mono font-medium">{to}</span>.</>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
            <div className="flex gap-2"><span className="text-muted-foreground w-12 shrink-0">To:</span><span className="font-mono break-all">{toName} &lt;{to}&gt;</span></div>
            {replyAll && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-12 shrink-0">Cc:</span>
                <Input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="comma-separated recipients (optional)"
                  className="h-7 text-xs font-mono"
                  aria-label="Cc recipients"
                />
              </div>
            )}
            <div className="flex gap-2"><span className="text-muted-foreground w-12 shrink-0">Subject:</span><span className="font-medium">{replySubject}</span></div>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your reply…"
            className="w-full min-h-[140px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground">
            Rate-limited to 5 replies/hour. The original message is quoted below your reply.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate({ text: body, cc: replyAll ? cc.trim() : undefined })}
            disabled={!body.trim() || mutation.isPending}
            className="gap-2"
          >
            {mutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {replyAll ? 'Send reply to all' : 'Send reply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Forward Dialog ----------
function ForwardDialog({
  messageId, onOpenChange,
}: {
  messageId: string | null
  onOpenChange: (v: boolean) => void
}) {
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const mutation = useMutation({
    mutationFn: (vars: { id: string; to: string; note: string }) =>
      fetch(`/api/messages/${vars.id}/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: vars.to, note: vars.note }),
      }).then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || 'Forward failed')
        return data
      }),
    onSuccess: (data) => {
      toast.success('Message forwarded', {
        description: `Delivered to ${data.to}`,
        duration: 3000,
      })
      setTo('')
      setNote('')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const validEmail = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(to.trim())

  return (
    <Dialog open={!!messageId} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="h-4 w-4 text-emerald-500" /> Forward message</DialogTitle>
          <DialogDescription>
            Forward a copy of this message to another email address via real SMTP.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">To</label>
            <Input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className={cn(to && !validEmail && 'border-red-500 focus-visible:ring-red-500')}
              autoFocus
            />
            {to && !validEmail && (
              <p className="text-xs text-red-500">Enter a valid email address</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note before the forwarded message…"
              className="w-full min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            The original message (with Fwd: prefix) will be sent from your inbox. Rate-limited to 5 forwards/hour.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => messageId && mutation.mutate({ id: messageId, to: to.trim(), note })}
            disabled={!validEmail || mutation.isPending}
            className="gap-2"
          >
            {mutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Forward
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Thread Group (collapsible conversation) ----------
function ThreadGroup({
  thread, isMuted, onMute, onUnmute,
}: {
  thread: MessageSummary[]
  isMuted?: boolean
  onMute?: () => void
  onUnmute?: () => void
}) {
  const [expanded, setExpanded] = useState(thread.length === 1)
  const latest = thread[thread.length - 1]
  const unreadCount = thread.filter(m => !m.isRead).length
  const openMessageId = useAppStore((s) => s.openMessageId)
  const setOpenMessageId = useAppStore((s) => s.setOpenMessageId)
  const setSelectedMessageId = useAppStore((s) => s.setSelectedMessageId)
  const updateMessage = useAppStore((s) => s.updateMessage)
  const removeMessage = useAppStore((s) => s.removeMessage)
  const queryClient = useQueryClient()

  // Listen for expand/collapse all events
  useEffect(() => {
    const onToggleAll = () => setExpanded(prev => !prev)
    window.addEventListener('studenttemp:thread-toggle-all', onToggleAll)
    return () => window.removeEventListener('studenttemp:thread-toggle-all', onToggleAll)
  }, [])

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { isRead?: boolean; isStarred?: boolean } }) =>
      api.updateMessage(id, data),
    onSuccess: (_d, vars) => {
      updateMessage(vars.id, vars.data)
      queryClient.invalidateQueries({ queryKey: ['messages'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMessage(id),
    onSuccess: (_d, id) => {
      removeMessage(id)
      queryClient.invalidateQueries({ queryKey: ['messages'] })
    },
  })

  const reportMutation = useMutation({
    mutationFn: ({ id, reason, category }: { id: string; reason: string; category: string }) =>
      api.reportMessage(id, reason, category),
    onSuccess: () => {
      toast.success('Message reported')
      queryClient.invalidateQueries({ queryKey: ['messages'] })
    },
  })

  const cat = CATEGORY_META[latest.category] || CATEGORY_META.general

  return (
    <div className={cn('bg-card', isMuted && 'opacity-60')}>
      {/* Thread header */}
      <div className="relative group">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left p-3 flex items-start gap-3 hover:bg-accent/30 transition-colors"
        >
          <div className="relative shrink-0">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 text-white font-bold text-sm">
              {latest.fromName[0]?.toUpperCase() || '?'}
            </div>
            {unreadCount > 0 && !isMuted && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 grid place-items-center rounded-full bg-emerald-500 text-[9px] font-bold text-white px-1 ring-2 ring-background">
                {unreadCount}
              </span>
            )}
            {isMuted && (
              <span className="absolute -top-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-zinc-400 text-white ring-2 ring-background" title="Conversation muted">
                <BellOff className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold truncate min-w-0">{latest.fromName}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {isMuted && (
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                    <BellOff className="h-2.5 w-2.5" /> Muted
                  </span>
                )}
                {thread.length > 1 && (
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                    {thread.length} messages
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground tabular-nums">{formatTime(latest.receivedAt)}</span>
              </div>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
              <span className="text-sm truncate flex-1 min-w-0 font-semibold">
                {latest.subject.replace(/^(re:\s*|fwd:\s*)+/i, '')}
              </span>
              <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{latest.previewText}</p>
          </div>
        </button>
        {/* G7: Mute / Unmute thread action — top-right of the thread header.
            Visible on hover (desktop) and always visible on mobile via
            group-hover fallback to opacity. Tap to toggle the mute state. */}
        <div className="absolute top-2 right-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          {isMuted ? (
            <button
              onClick={(e) => { e.stopPropagation(); onUnmute?.() }}
              className="grid h-7 w-7 place-items-center rounded-md bg-background/90 border border-border/60 hover:bg-emerald-500/10 text-emerald-600"
              title="Unmute conversation"
              aria-label="Unmute conversation"
            >
              <Bell className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onMute?.() }}
              className="grid h-7 w-7 place-items-center rounded-md bg-background/90 border border-border/60 hover:bg-accent text-muted-foreground"
              title="Mute conversation"
              aria-label="Mute conversation"
            >
              <BellOff className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded thread messages */}
      <AnimatePresence initial={false}>
        {expanded && thread.length > 1 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden border-t border-border/40"
          >
            <ul className="divide-y divide-border/30">
              {thread.map((msg) => (
                <li key={msg.id}>
                  <button
                    onClick={() => { setOpenMessageId(msg.id); setSelectedMessageId(msg.id) }}
                    className={cn(
                      'w-full text-left px-3 py-2.5 flex gap-2.5 hover:bg-accent/30 transition-colors',
                      openMessageId === msg.id && 'bg-emerald-500/10'
                    )}
                  >
                    <div className="flex-1 min-w-0 overflow-hidden pl-6">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs truncate flex-1 min-w-0', msg.isRead ? 'text-muted-foreground' : 'font-bold text-foreground')}>
                          {msg.fromName}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(msg.receivedAt)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.subject}</p>
                    </div>
                    {!msg.isRead && <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 mt-1" />}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

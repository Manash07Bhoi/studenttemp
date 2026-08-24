'use client'

import { useEffect, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Inbox as InboxIcon, Mail, AtSign, Settings as SettingsIcon, Info, Shield, Activity, Github, Zap } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { RealtimeMessage } from '@/lib/types'
import { useAppStore, type SectionId } from '@/lib/store'
import { useSocket } from '@/hooks/use-socket'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/theme-toggle'
import { InboxSection } from '@/components/sections/inbox-section'
import { MessagesSection } from '@/components/sections/messages-section'
import { AddressesSection } from '@/components/sections/addresses-section'
import { SettingsSection } from '@/components/sections/settings-section'
import { AboutSection } from '@/components/sections/about-section'

const NAV_ITEMS: { id: SectionId; label: string; icon: typeof InboxIcon }[] = [
  { id: 'inbox', label: 'Inbox', icon: InboxIcon },
  { id: 'messages', label: 'Messages', icon: Mail },
  { id: 'addresses', label: 'My Addresses', icon: AtSign },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
  { id: 'about', label: 'About', icon: Info },
]

export function AppShell() {
  const activeSection = useAppStore((s) => s.activeSection)
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const activeInboxId = useAppStore((s) => s.activeInboxId)
  const inboxes = useAppStore((s) => s.inboxes)
  const setInboxes = useAppStore((s) => s.setInboxes)
  const upsertInbox = useAppStore((s) => s.upsertInbox)
  const removeInbox = useAppStore((s) => s.removeInbox)
  const updateInbox = useAppStore((s) => s.updateInbox)
  const prependMessage = useAppStore((s) => s.prependMessage)
  const markFresh = useAppStore((s) => s.markFresh)
  const clearFresh = useAppStore((s) => s.clearFresh)
  const setActiveInboxId = useAppStore((s) => s.setActiveInboxId)
  const setOpenMessageId = useAppStore((s) => s.setOpenMessageId)
  const messages = useAppStore((s) => s.messages)
  const queryClient = useQueryClient()

  // Load inboxes once
  const { data: inboxesData } = useQuery({
    queryKey: ['inboxes'],
    queryFn: api.listInboxes,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (inboxesData?.inboxes) setInboxes(inboxesData.inboxes)
  }, [inboxesData, setInboxes])

  // Auto-select the most recent active inbox if none is selected
  useEffect(() => {
    if (!activeInboxId && inboxes.length > 0) {
      setActiveInboxId(inboxes[0].id)
    }
  }, [activeInboxId, inboxes, setActiveInboxId])

  // active inbox object
  const activeInbox = useMemo(
    () => inboxes.find((i) => i.id === activeInboxId) || null,
    [inboxes, activeInboxId]
  )

  // Socket: handle new messages + expiration
  const onMessage = useCallback(
    (msg: RealtimeMessage) => {
      // Only show if it belongs to the currently active inbox
      if (activeInbox && msg.inboxId === activeInbox.id) {
        prependMessage({
          id: msg.id,
          fromEmail: msg.fromEmail,
          fromName: msg.fromName,
          subject: msg.subject,
          previewText: msg.previewText,
          isRead: msg.isRead,
          isStarred: false,
          receivedAt: msg.receivedAt,
          category: msg.category,
          hasAttachment: msg.hasAttachment,
          scanStatus: msg.scanStatus,
          spf: 'pass',
          dkim: 'pass',
          dmarc: 'pass',
          externalResourcesBlocked: 0,
          isReported: false,
        })
        markFresh(msg.id)
        setTimeout(() => clearFresh(), 2000)

        // Update unread count in store
        if (activeInbox._count) {
          updateInbox(activeInbox.id, { _count: { messages: (activeInbox._count.messages || 0) + 1 } })
        }

        // Update document title if tab is inactive
        if (typeof document !== 'undefined' && document.hidden) {
          const prev = document.title
          document.title = `(1) New mail — StudentTemp`
          const onVis = () => {
            document.title = prev
            document.removeEventListener('visibilitychange', onVis)
          }
          document.addEventListener('visibilitychange', onVis)
        }

        toast.success('New message arrived', {
          description: `${msg.fromName}: ${msg.subject}`,
          duration: 4000,
        })
      }
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    [activeInbox, prependMessage, markFresh, clearFresh, updateInbox, queryClient]
  )

  const onInboxExpired = useCallback(
    (data: { inboxId: string; email: string }) => {
      removeInbox(data.inboxId)
      if (data.inboxId === activeInboxId) {
        setActiveInboxId(null)
      }
      toast.warning(`Inbox expired: ${data.email}`, { duration: 5000 })
      queryClient.invalidateQueries({ queryKey: ['inboxes'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    [removeInbox, activeInboxId, setActiveInboxId, queryClient]
  )

  const { isConnected, subscribeInbox, triggerGenerate } = useSocket({
    onMessage,
    onInboxExpired,
  })

  // Subscribe socket to active inbox email
  useEffect(() => {
    subscribeInbox(activeInbox?.email || null)
  }, [activeInbox?.email, subscribeInbox])

  const unreadCount = useMemo(() => messages.filter((m) => !m.isRead).length, [messages])

  const ActiveSection = {
    inbox: InboxSection,
    messages: MessagesSection,
    addresses: AddressesSection,
    settings: SettingsSection,
    about: AboutSection,
  }[activeSection]

  const handleSectionClick = (id: SectionId) => {
    setActiveSection(id)
    if (id === 'messages') setOpenMessageId(null)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <button
            onClick={() => handleSectionClick('inbox')}
            className="flex items-center gap-2.5 shrink-0 group"
            aria-label="StudentTemp home"
          >
            <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-sm shadow-emerald-500/30 transition-transform group-hover:scale-105">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6 L12 11 L20 6" />
                <rect x="3" y="5" width="18" height="14" rx="2" />
              </svg>
            </span>
            <div className="hidden sm:block leading-none">
              <div className="text-[15px] font-bold tracking-tight">
                Student<span className="text-gradient-brand">Temp</span>
              </div>
              <div className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Disposable Email</div>
            </div>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 ml-4" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const active = activeSection === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => handleSectionClick(item.id)}
                  className={`relative px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    {item.label}
                    {item.id === 'messages' && unreadCount > 0 && (
                      <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                        {unreadCount}
                      </span>
                    )}
                  </span>
                  {active && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs">
              <span className={`relative flex h-2 w-2 ${isConnected ? '' : 'opacity-40'}`}>
                {isConnected && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                )}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
              </span>
              <span className="text-muted-foreground font-medium">{isConnected ? 'Live' : 'Connecting'}</span>
            </div>
            <ThemeToggle />
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:grid place-items-center h-9 w-9 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              aria-label="View source"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Mobile nav (horizontal scroll) */}
        <nav className="md:hidden flex items-center gap-1 overflow-x-auto no-scrollbar px-3 pb-2" aria-label="Mobile primary">
          {NAV_ITEMS.map((item) => {
            const active = activeSection === item.id
            return (
              <button
                key={item.id}
                onClick={() => handleSectionClick(item.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/50'
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
                {item.id === 'messages' && unreadCount > 0 && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-background text-primary text-[10px] font-bold px-1">
                    {unreadCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <ActiveSection triggerGenerate={triggerGenerate} />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="h-4 w-4 text-emerald-500" />
            <span>Privacy-first · No tracking · No sign-up</span>
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
            <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Real-time delivery</span>
            <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> {inboxes.length} active</span>
          </div>
          <div className="text-xs text-muted-foreground">
            This is a private temporary address, not an official institution email.
          </div>
        </div>
      </footer>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, Mail, AtSign, Settings as SettingsIcon, Info, Shield, Activity, Zap, Plus, Lock, Command as CommandIcon, BarChart3 } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { RealtimeMessage } from '@/lib/types'
import { useAppStore, type SectionId } from '@/lib/store'
import { useSocket } from '@/hooks/use-socket'
import { useBroadcastChannel } from '@/hooks/use-broadcast'
import { useSound } from '@/hooks/use-settings'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/theme-toggle'
import { SideDrawer } from '@/components/side-drawer'
import { CommandPalette } from '@/components/command-palette'
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { InboxSection } from '@/components/sections/inbox-section'
import { MessagesSection } from '@/components/sections/messages-section'
import { AddressesSection } from '@/components/sections/addresses-section'
import { ComposeSection } from '@/components/sections/compose-section'
import { SettingsSection } from '@/components/sections/settings-section'
import { AboutSection } from '@/components/sections/about-section'
import { LegalSection } from '@/components/sections/legal-section'
import { AppLockSection, LockScreen, useAutoLock } from '@/components/sections/applock-section'
import { OnboardingOverlay } from '@/components/sections/onboarding-overlay'
import { AnalyticsSection } from '@/components/sections/analytics-section'

const NAV_ITEMS: { id: SectionId; label: string; icon: typeof InboxIcon }[] = [
  { id: 'inbox', label: 'Inbox', icon: Mail },
  { id: 'messages', label: 'Messages', icon: Activity },
  { id: 'addresses', label: 'Addresses', icon: AtSign },
  { id: 'compose', label: 'Compose', icon: Plus },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
  { id: 'about', label: 'About', icon: Info },
]

function InboxIcon() { return <Mail className="h-4 w-4" /> }

export function AppShell() {
  const activeSection = useAppStore((s) => s.activeSection)
  const sectionParams = useAppStore((s) => s.sectionParams)
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen)
  const activeInboxId = useAppStore((s) => s.activeInboxId)
  const inboxes = useAppStore((s) => s.inboxes)
  const setInboxes = useAppStore((s) => s.setInboxes)
  const upsertInbox = useAppStore((s) => s.upsertInbox)
  const removeInbox = useAppStore((s) => s.removeInbox)
  const updateInbox = useAppStore((s) => s.updateInbox)
  const prependMessage = useAppStore((s) => s.prependMessage)
  const updateMessage = useAppStore((s) => s.updateMessage)
  const removeMessage = useAppStore((s) => s.removeMessage)
  const markFresh = useAppStore((s) => s.markFresh)
  const clearFresh = useAppStore((s) => s.clearFresh)
  const setActiveInboxId = useAppStore((s) => s.setActiveInboxId)
  const setOpenMessageId = useAppStore((s) => s.setOpenMessageId)
  const messages = useAppStore((s) => s.messages)
  const hasSeenOnboarding = useAppStore((s) => s.hasSeenOnboarding)
  const appLockEnabled = useAppStore((s) => s.appLockEnabled)
  const queryClient = useQueryClient()
  const sound = useSound()

  // App-wide auto-lock: listens for page-visibility changes (tab backgrounded,
  // app minimized, screen off) and engages the lock screen when the configured
  // delay has elapsed. Also exposes `lockNow` for the header button.
  const { lockNow } = useAutoLock()

  // Global keyboard shortcuts (g-prefix nav, copy / refresh / focus-search,
  // j/k message navigation, ⌘K palette, ? shortcuts help, Esc dismiss).
  // Internally suppresses shortcuts while typing in inputs (except ⌘K + Esc).
  useKeyboardShortcuts()

  // Command palette + shortcuts help are driven by store state so both the
  // hook and the header ⌘K button can open them.
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)

  const { data: inboxesData } = useQuery({
    queryKey: ['inboxes'],
    queryFn: api.listInboxes,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (inboxesData?.inboxes) setInboxes(inboxesData.inboxes)
  }, [inboxesData, setInboxes])

  useEffect(() => {
    if (!activeInboxId && inboxes.length > 0) {
      setActiveInboxId(inboxes[0].id)
    }
  }, [activeInboxId, inboxes, setActiveInboxId])

  const activeInbox = useMemo(
    () => inboxes.find((i) => i.id === activeInboxId) || null,
    [inboxes, activeInboxId]
  )

  const onMessage = useCallback((msg: RealtimeMessage) => {
    if (activeInbox && msg.inboxId === activeInbox.id) {
      prependMessage({
        id: msg.id,
        fromEmail: msg.fromEmail,
        fromName: msg.fromName,
        senderAddress: msg.fromEmail,
        senderDisplayName: msg.fromName,
        subject: msg.subject,
        previewText: msg.previewText,
        isRead: msg.isRead,
        isStarred: false,
        receivedAt: msg.receivedAt,
        category: msg.category,
        hasAttachment: msg.hasAttachment,
        scanStatus: msg.scanStatus,
        spf: msg.spf,
        dkim: msg.dkim,
        dmarc: msg.dmarc,
        externalResourcesBlocked: 0,
        isReported: false,
        sizeBytes: 0,
        publicId: msg.publicId,
      })
      markFresh(msg.id)
      setTimeout(() => clearFresh(), 2000)
      if (activeInbox._count) {
        updateInbox(activeInbox.id, { _count: { messages: (activeInbox._count.messages || 0) + 1 } })
      }
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
      sound.playNewMessage()
    }
    queryClient.invalidateQueries({ queryKey: ['stats'] })
  }, [activeInbox, prependMessage, markFresh, clearFresh, updateInbox, queryClient, sound])

  const onInboxExpired = useCallback((data: { inboxId: string; email: string }) => {
    removeInbox(data.inboxId)
    if (data.inboxId === activeInboxId) {
      setActiveInboxId(null)
      setActiveSection('expired', { email: data.email })
    }
    toast.warning(`Inbox expired: ${data.email}`, { duration: 5000 })
    queryClient.invalidateQueries({ queryKey: ['inboxes'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
  }, [removeInbox, activeInboxId, setActiveInboxId, setActiveSection, queryClient])

  const { isConnected, subscribeInbox, triggerGenerate } = useSocket({
    onMessage,
    onInboxExpired,
  })

  // Multi-tab sync via BroadcastChannel (WORKFLOWS.md H4)
  useBroadcastChannel(useCallback((payload) => {
    if (!payload) return
    if (payload.type === 'message:new') {
      // Don't double-toast in another tab; just prepend if it's the active inbox
      const msg = payload.msg
      if (activeInbox && msg.inboxId === activeInbox.id) {
        prependMessage({
          id: msg.id, fromEmail: msg.fromEmail, fromName: msg.fromName,
          senderAddress: msg.fromEmail, senderDisplayName: msg.fromName,
          subject: msg.subject, previewText: msg.previewText, isRead: false, isStarred: false,
          receivedAt: msg.receivedAt, category: msg.category, hasAttachment: msg.hasAttachment,
          scanStatus: msg.scanStatus, spf: msg.spf, dkim: msg.dkim, dmarc: msg.dmarc,
          externalResourcesBlocked: 0, isReported: false, sizeBytes: 0, publicId: msg.publicId,
        })
      }
    } else if (payload.type === 'message:updated') {
      updateMessage(payload.id, payload.patch)
    } else if (payload.type === 'message:deleted') {
      removeMessage(payload.id)
    } else if (payload.type === 'inbox:deleted') {
      removeInbox(payload.id)
    } else if (payload.type === 'inbox:expired') {
      onInboxExpired(payload.data)
    }
  }, [activeInbox, prependMessage, updateMessage, removeMessage, removeInbox, onInboxExpired]))

  useEffect(() => {
    subscribeInbox(activeInbox?.email || null)
  }, [activeInbox?.email, subscribeInbox])

  const unreadCount = useMemo(() => messages.filter((m) => !m.isRead).length, [messages])

  const sections: Record<SectionId, React.ComponentType<{ triggerGenerate: (email: string) => void }>> = {
    inbox: InboxSection,
    messages: MessagesSection,
    addresses: AddressesSection,
    settings: SettingsSection,
    about: AboutSection,
    legal: LegalSection,
    applock: AppLockSection,
    expired: InboxSection, // expired reuses inbox section (shows generate CTA)
    onboarding: InboxSection,
    compose: ComposeSection,
    sessions: SettingsSection,
    analytics: AnalyticsSection,
  }

  const ActiveSection = sections[activeSection] || InboxSection

  const handleSectionClick = (id: SectionId) => {
    setActiveSection(id)
    if (id === 'messages') setOpenMessageId(null)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <OnboardingOverlay />
      {/* App-wide lock screen. Self-gates on `appLockEnabled && isLocked` so it
          is invisible unless the user has set up App Lock AND the lock is engaged.
          Mounted AFTER OnboardingOverlay so onboarding takes precedence on the
          very first run (lock is meaningless until a PIN exists). */}
      <LockScreen />
      <SideDrawer />

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden grid h-9 w-9 place-items-center rounded-lg hover:bg-accent transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
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
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCommandPaletteOpen(true)}
                    className="hidden md:inline-flex h-9 gap-2 pr-2 pl-2.5 text-muted-foreground hover:text-foreground"
                    aria-label="Open command palette"
                  >
                    <CommandIcon className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs">Search</span>
                    <kbd className="ml-1 inline-flex h-5 items-center gap-0.5 rounded border border-border/70 bg-muted px-1 font-mono text-[10px] tracking-wider text-muted-foreground">
                      ⌘K
                    </kbd>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Open command palette (⌘K)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <ThemeToggle />
            {appLockEnabled && (
              <button
                onClick={lockNow}
                className="grid h-9 w-9 place-items-center rounded-lg border border-border/60 hover:bg-accent transition-colors text-emerald-600 dark:text-emerald-400"
                aria-label="Lock now"
                title="Lock now"
              >
                <Lock className="h-4 w-4" />
              </button>
            )}
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

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection + JSON.stringify(sectionParams)}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <ActiveSection triggerGenerate={triggerGenerate} />
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="mt-auto border-t border-border/60 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="h-4 w-4 text-emerald-500" />
            <span>Privacy-first · No tracking · No sign-up</span>
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
            <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Real-time</span>
            <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> {inboxes.length} active</span>
          </div>
          <div className="text-xs text-foreground/70 font-medium">
            This is a private temporary address, not an official institution email.
          </div>
        </div>
      </footer>

      {/* Command palette (⌘K) + keyboard shortcuts help (?) — driven by store state */}
      <CommandPalette />
      <KeyboardShortcutsDialog />
    </div>
  )
}

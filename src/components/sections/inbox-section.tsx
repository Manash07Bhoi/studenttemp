'use client'

import { useState, useEffect, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Copy, Check, RefreshCw, QrCode as QrIcon, Clock, Mail, Sparkles, AtSign,
  Trash2, Plus, AlertCircle, Zap, ArrowRight, Info, ShieldCheck, Flame,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type { Inbox } from '@/lib/types'
import { ScrambleText } from '@/components/scramble-text'
import { CountdownTimer } from '@/components/countdown-timer'
import { QrCode } from '@/components/qr-code'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useI18n } from '@/hooks/use-i18n'

export function InboxSection({ triggerGenerate }: { triggerGenerate: (email: string) => void }) {
  const activeInboxId = useAppStore((s) => s.activeInboxId)
  const inboxes = useAppStore((s) => s.inboxes)
  const upsertInbox = useAppStore((s) => s.upsertInbox)
  const removeInbox = useAppStore((s) => s.removeInbox)
  const updateInbox = useAppStore((s) => s.updateInbox)
  const setActiveInboxId = useAppStore((s) => s.setActiveInboxId)
  const setInboxMirror = useAppStore((s) => s.setInboxMirror)
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const setMessages = useAppStore((s) => s.setMessages)
  const queryClient = useQueryClient()
  const { t } = useI18n()

  const activeInbox = inboxes.find((i) => i.id === activeInboxId) || null
  const [copied, setCopied] = useState(false)
  const [scrambleKey, setScrambleKey] = useState(0)
  const [showCustomize, setShowCustomize] = useState(false)
  const [showQr, setShowQr] = useState(false)

  const { data: domainsData } = useQuery({ queryKey: ['domains'], queryFn: api.getDomains, staleTime: Infinity })
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: api.getStats, refetchInterval: 20_000 })

  useEffect(() => {
    if (activeInbox?.email) setScrambleKey((k) => k + 1)
  }, [activeInbox?.email])

  const copyEmail = useCallback(async () => {
    if (!activeInbox) return
    try {
      await navigator.clipboard.writeText(activeInbox.email)
      setCopied(true)
      toast.success('Copied to clipboard', { description: activeInbox.email, duration: 1800 })
      setTimeout(() => setCopied(false), 2200)
    } catch {
      toast.error('Could not copy — please copy manually')
    }
  }, [activeInbox])

  const createMutation = useMutation({
    mutationFn: (vars: Parameters<typeof api.createInbox>[0]) => api.createInbox(vars),
    onSuccess: (data) => {
      upsertInbox(data.inbox)
      setActiveInboxId(data.inbox.id)
      // Store inbox mirror in localStorage for persistence across tab close/reopen
      setInboxMirror({
        id: data.inbox.id,
        email: data.inbox.email,
        expiresAt: data.inbox.expiresAt,
      })
      setMessages([])
      queryClient.invalidateQueries({ queryKey: ['inboxes'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('New inbox created', { description: data.inbox.email })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteInbox(id),
    onSuccess: (_d, id) => {
      removeInbox(id)
      queryClient.invalidateQueries({ queryKey: ['inboxes'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Inbox deleted')
    },
  })

  const extendMutation = useMutation({
    mutationFn: ({ id, mins }: { id: string; mins: number }) => api.extendInbox(id, mins),
    onSuccess: (data) => {
      updateInbox(data.inbox.id, { expiresAt: data.inbox.expiresAt })
      queryClient.invalidateQueries({ queryKey: ['inboxes'] })
      toast.success('Inbox extended', { description: `Expires ${new Date(data.inbox.expiresAt).toLocaleTimeString()}` })
    },
  })

  const handleGenerate = () => {
    createMutation.mutate({
      domain: domainsData?.domains[0]?.domain || 'studentbox.in',
      lifetimeMinutes: 10,
    })
  }

  // Listen for global "generate inbox" events dispatched by the keyboard
  // shortcuts hook (n key) and the command palette (Generate new inbox action).
  // We re-subscribe whenever the available domains list changes so the
  // listener always uses the freshest domain preference.
  useEffect(() => {
    const onGen = () => {
      createMutation.mutate({
        domain: domainsData?.domains[0]?.domain || 'studentbox.in',
        lifetimeMinutes: 10,
      })
    }
    window.addEventListener('studenttemp:generate-inbox', onGen)
    return () => window.removeEventListener('studenttemp:generate-inbox', onGen)
  }, [domainsData?.domains, createMutation])

  const handleTriggerMail = async () => {
    if (!activeInbox) return
    // Send a real test email via our API endpoint (server-side nodemailer → SMTP)
    try {
      toast.info('Sending test email...', { description: `To: ${activeInbox.email}` })
      const res = await fetch(`/api/inboxes/${activeInbox.id}/test-mail`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success('Test email sent!', {
        description: 'Check Messages tab — it should appear in seconds.',
        duration: 4000,
      })
    } catch (e) {
      toast.error('Failed to send test email: ' + (e as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero / Active Inbox Card */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-emerald-500/5 p-6 sm:p-8 shadow-sm">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-64 w-64 rounded-full bg-gradient-to-tr from-emerald-500/10 to-transparent blur-3xl" aria-hidden />

        <div className="relative space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {t('inbox.yourTemporaryInbox')}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeInbox
                  ? 'Share this address. Mail arrives here in real time.'
                  : t('inbox.generateDisposable')}
              </p>
            </div>
            {activeInbox && (
              <CountdownTimer expiresAt={activeInbox.expiresAt} onExpire={() => removeInbox(activeInbox.id)} />
            )}
          </div>

          {/* Email display */}
          <AnimatePresence mode="wait">
            {activeInbox ? (
              <motion.div
                key={activeInbox.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <div className="group relative flex items-center gap-2 rounded-xl border-2 border-dashed border-emerald-500/30 bg-background/60 p-3 sm:p-4">
                  <AtSign className="h-5 w-5 shrink-0 text-emerald-500" />
                  <button
                    onClick={copyEmail}
                    onDoubleClick={copyEmail}
                    className="flex-1 text-left font-mono text-lg sm:text-2xl font-bold tracking-tight break-all"
                    title="Click or double-click to copy"
                  >
                    <ScrambleText key={scrambleKey} text={activeInbox.email} className="text-gradient-brand" />
                  </button>
                  <Badge variant="secondary" className="shrink-0 gap-1">
                    {activeInbox.isCustom ? <Sparkles className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                    {activeInbox.isCustom ? 'Custom' : 'Random'}
                  </Badge>
                </div>

                {/* Action buttons */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={copyEmail} variant={copied ? 'default' : 'outline'} size="sm" className="gap-2">
                    <AnimatePresence mode="wait" initial={false}>
                      {copied ? (
                        <motion.span key="ok" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
                          <Check className="h-4 w-4" />
                        </motion.span>
                      ) : (
                        <motion.span key="copy" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
                          <Copy className="h-4 w-4" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button onClick={() => setShowQr(true)} variant="outline" size="sm" className="gap-2">
                    <QrIcon className="h-4 w-4" /> Share QR
                  </Button>
                  <Button onClick={() => setShowCustomize(true)} variant="outline" size="sm" className="gap-2">
                    <Sparkles className="h-4 w-4" /> Customize
                  </Button>
                  <Button onClick={() => extendMutation.mutate({ id: activeInbox.id, mins: 10 })} variant="outline" size="sm" className="gap-2" disabled={extendMutation.isPending}>
                    <Clock className="h-4 w-4" /> +10 min
                  </Button>
                  <Button onClick={handleTriggerMail} variant="outline" size="sm" className="gap-2">
                    <Mail className="h-4 w-4" /> Test mail
                  </Button>
                  <Button
                    onClick={() => {
                      if (confirm('Delete this inbox? All messages will be lost.')) deleteMutation.mutate(activeInbox.id)
                    }}
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </div>

                {/* Meta info */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Domain</div>
                    <div className="font-semibold truncate" title={typeof activeInbox.domain === 'string' ? activeInbox.domain : activeInbox.domain?.domain}>{typeof activeInbox.domain === 'string' ? activeInbox.domain : activeInbox.domain?.domain || activeInbox.domain}</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Created</div>
                    <div className="font-semibold tabular-nums">{new Date(activeInbox.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Messages</div>
                    <div className="font-semibold tabular-nums">{activeInbox._count?.messages || 0}</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">Mode</div>
                    <div className="font-semibold capitalize flex items-center gap-1">
                      {activeInbox.burnOnRead && <Flame className="h-3 w-3 text-orange-500" />}
                      {activeInbox.burnOnRead ? 'Burn-on-read' : 'Standard'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-emerald-500/8 border border-emerald-500/20 px-3 py-2.5 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>{t('inbox.tapToCopy')}</span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border-2 border-dashed border-border p-8 text-center"
              >
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500 animate-float">
                  <Mail className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold">{t('inbox.noActiveInbox')}</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  Generate a fresh disposable email address to start receiving mail in seconds.
                </p>
                <Button onClick={handleGenerate} className="mt-5 gap-2 animate-glow-brand" disabled={createMutation.isPending}>
                  <Plus className="h-4 w-4" /> Generate my inbox
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {createMutation.isPending && !activeInbox && (
            <div className="space-y-3 animate-stagger">
              <div className="h-12 w-full rounded-xl bg-muted shimmer" />
              <div className="h-8 w-48 rounded-lg bg-muted shimmer" />
              <div className="h-20 w-full rounded-xl bg-muted shimmer" />
            </div>
          )}
        </div>
      </section>

      {/* Quick stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Your active inboxes" value={stats?.session.activeInboxes ?? 0} icon={<AtSign className="h-4 w-4" />} />
        <StatCard label="Messages received" value={stats?.session.totalMessages ?? 0} icon={<Mail className="h-4 w-4" />} />
        <StatCard label="Global active" value={stats?.global.activeInboxes ?? 0} icon={<ActivityIcon />} />
        <StatCard label="Total delivered" value={stats?.global.totalMessages ?? 0} icon={<Zap className="h-4 w-4" />} />
      </section>

      {/* Quick actions / recent */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Info className="h-4 w-4 text-emerald-500" />{t('inbox.howItWorks')}
          </h3>
          <ol className="mt-3 space-y-2.5 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">1</span>
              <span>Generate a temporary address above (random or custom).</span>
            </li>
            <li className="flex gap-3">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">2</span>
              <span>Copy it and use it to sign up anywhere on the web.</span>
            </li>
            <li className="flex gap-3">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">3</span>
              <span>Incoming mail appears in real time — no refresh needed.</span>
            </li>
            <li className="flex gap-3">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">4</span>
              <span>The inbox auto-expires when the timer hits zero.</span>
            </li>
          </ol>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />{t('inbox.safetyPrivacy')}
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" /> No sign-up, no personal data collected</li>
            <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" /> External resources in emails are blocked</li>
            <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" /> SPF/DKIM/DMARC results shown per message</li>
            <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" /> Inboxes auto-delete on expiry</li>
            <li className="flex gap-2"><AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" /> <span>Not for sensitive accounts — anyone with the address can read the mail.</span></li>
          </ul>
          <Button
            variant="link"
            size="sm"
            className="mt-3 h-auto p-0 text-emerald-600 dark:text-emerald-400"
            onClick={() => setActiveSection('about')}
          >
            Learn more <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </section>

      {/* Customize dialog */}
      <CustomizeDialog
        open={showCustomize}
        onOpenChange={setShowCustomize}
        domains={domainsData?.domains || []}
        lifetimeOptions={domainsData?.lifetimeOptions || []}
        categories={domainsData?.categories || []}
        onCreated={(inbox) => {
          setShowCustomize(false)
          upsertInbox(inbox)
          setActiveInboxId(inbox.id)
          setMessages([])
          queryClient.invalidateQueries({ queryKey: ['inboxes'] })
          toast.success('Custom inbox created', { description: inbox.email })
        }}
      />

      {/* QR dialog */}
      <Dialog open={showQr} onOpenChange={setShowQr}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><QrIcon className="h-4 w-4" /> Share via QR</DialogTitle>
            <DialogDescription>Scan to send mail to this inbox from any device.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {activeInbox && <QrCode value={`mailto:${activeInbox.email}`} size={180} />}
            <p className="font-mono text-sm font-medium break-all text-center">{activeInbox?.email}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ActivityIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-emerald-500">{icon}</span>
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  )
}

// ---------------- Customize Dialog ----------------
function CustomizeDialog({
  open, onOpenChange, domains, lifetimeOptions, categories, onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  domains: Array<{ domain: string; label: string; badge: string; popular: boolean }>
  lifetimeOptions: Array<{ value: number; label: string; default?: boolean }>
  categories: Array<{ value: string; label: string; desc: string }>
  onCreated: (inbox: Inbox) => void
}) {
  const [localPart, setLocalPart] = useState('')
  const [domain, setDomain] = useState(domains[0]?.domain || 'studentbox.in')
  const [lifetime, setLifetime] = useState(lifetimeOptions.find(o => o.default)?.value || 10)
  const [category, setCategory] = useState('general')
  const [burnOnRead, setBurnOnRead] = useState(false)
  const [checkState, setCheckState] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [checkReason, setCheckReason] = useState('')
  const queryClient = useQueryClient()

  useEffect(() => {
    if (open) {
      setLocalPart('')
      setDomain(domains[0]?.domain || 'studentbox.in')
      setLifetime(lifetimeOptions.find(o => o.default)?.value || 10)
      setCategory('general')
      setBurnOnRead(false)
      setCheckState('idle')
      setCheckReason('')
    }
  }, [open, domains, lifetimeOptions])

  useEffect(() => {
    if (!localPart || localPart.length < 3) {
      setCheckState('idle')
      setCheckReason('')
      return
    }
    setCheckState('checking')
    const handle = setTimeout(async () => {
      try {
        const res = await api.checkAlias(localPart, domain)
        if (res.available) {
          setCheckState('available')
          setCheckReason('')
        } else {
          setCheckState('taken')
          setCheckReason(res.reason || 'Not available')
        }
      } catch {
        setCheckState('idle')
      }
    }, 500)
    return () => clearTimeout(handle)
  }, [localPart, domain])

  const createMutation = useMutation({
    mutationFn: () =>
      api.createInbox({
        domain,
        lifetimeMinutes: lifetime,
        category,
        customLocalPart: localPart,
        burnOnRead,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      onCreated(data.inbox)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const canSubmit = checkState === 'available' && !createMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-emerald-500" /> Customize your address</DialogTitle>
          <DialogDescription>Pick a memorable local-part. It still expires like a random one.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="local">Local part</Label>
            <div className="flex items-stretch gap-2">
              <div className="relative flex-1">
                <Input
                  id="local"
                  value={localPart}
                  onChange={(e) => setLocalPart(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                  placeholder="rahul.dev"
                  maxLength={30}
                  className={cn(
                    'pr-10 font-mono',
                    checkState === 'available' && 'border-emerald-500 focus-visible:ring-emerald-500',
                    checkState === 'taken' && 'border-red-500 focus-visible:ring-red-500'
                  )}
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkState === 'checking' && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {checkState === 'available' && <Check className="h-4 w-4 text-emerald-500" />}
                  {checkState === 'taken' && <AlertCircle className="h-4 w-4 text-red-500" />}
                </span>
              </div>
              <Select value={domain} onValueChange={setDomain}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {(() => {
                    // Group domains by pack
                    const packs: Record<string, string> = {
                      indian_student: '🇮🇳 India Student',
                      standard: '🇮🇳 India General',
                      international: '🌍 International',
                      privacy: '🔒 Privacy',
                      academic: '🎓 Academic (.edu/.ac.in)',
                    }
                    const grouped: Record<string, typeof domains> = {}
                    for (const d of domains) {
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
                            {d.badge && <span className="text-[9px] text-emerald-500 font-semibold">{d.badge}</span>}
                          </SelectItem>
                        ))}
                      </div>
                    ))
                  })()}
                </SelectContent>
              </Select>
            </div>
            {checkState === 'taken' && (
              <motion.p
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-xs text-red-500 flex items-center gap-1"
              >
                <AlertCircle className="h-3 w-3" /> {checkReason}
              </motion.p>
            )}
            {checkState === 'available' && (
              <motion.p
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
              >
                <Check className="h-3 w-3" /> Available — {localPart}@{domain}
              </motion.p>
            )}
            <p className="text-[11px] text-muted-foreground">3–30 chars · letters, numbers, . _ - · no reserved words</p>
          </div>

          <div className="space-y-2">
            <Label>Lifetime</Label>
            <Select value={String(lifetime)} onValueChange={(v) => setLifetime(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {lifetimeOptions.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label} — <span className="text-muted-foreground">{c.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
            <div>
              <Label htmlFor="burn" className="flex items-center gap-1.5 cursor-pointer">
                <Flame className="h-3.5 w-3.5 text-orange-500" /> Burn-on-read
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">Inbox expires 60 seconds after the first message is read.</p>
            </div>
            <Switch id="burn" checked={burnOnRead} onCheckedChange={setBurnOnRead} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!canSubmit} className="gap-2">
            {createMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Create inbox
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

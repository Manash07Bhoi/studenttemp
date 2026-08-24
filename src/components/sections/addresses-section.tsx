'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AtSign, Plus, Trash2, Mail, Sparkles, Zap, Flame, Copy, Check, ChevronRight, Clock,
} from 'lucide-react'
import { useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type { Inbox } from '@/lib/types'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CountdownTimer } from '@/components/countdown-timer'
import { cn } from '@/lib/utils'

export function AddressesSection({ triggerGenerate: _triggerGenerate }: { triggerGenerate: (email: string) => void }) {
  const inboxes = useAppStore((s) => s.inboxes)
  const activeInboxId = useAppStore((s) => s.activeInboxId)
  const setActiveInboxId = useAppStore((s) => s.setActiveInboxId)
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const removeInbox = useAppStore((s) => s.removeInbox)
  const updateInbox = useAppStore((s) => s.updateInbox)
  const setMessages = useAppStore((s) => s.setMessages)
  const queryClient = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const { data: domainsData } = useQuery({ queryKey: ['domains'], queryFn: api.getDomains, staleTime: Infinity })

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
      toast.success('Inbox extended', { description: `Now expires ${new Date(data.inbox.expiresAt).toLocaleTimeString()}` })
    },
  })

  const copyEmail = useCallback(async (inbox: Inbox) => {
    try {
      await navigator.clipboard.writeText(inbox.email)
      setCopiedId(inbox.id)
      toast.success('Copied', { description: inbox.email, duration: 1800 })
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Could not copy')
    }
  }, [])

  const handleSwitch = (id: string) => {
    setActiveInboxId(id)
    setActiveSection('messages')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <AtSign className="h-5 w-5 text-emerald-500" /> My Addresses
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage up to 5 active inboxes at once. Switch between them anytime.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2" disabled={inboxes.length >= 5}>
          <Plus className="h-4 w-4" /> New address
        </Button>
      </div>

      {/* Inbox count + quota bar */}
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Active inboxes</span>
          <span className="font-mono text-muted-foreground">{inboxes.length} / 5</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
            initial={{ width: 0 }}
            animate={{ width: `${(inboxes.length / 5) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Inbox cards grid */}
      {inboxes.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500">
            <AtSign className="h-7 w-7" />
          </div>
          <h3 className="font-semibold">No active inboxes</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create your first disposable address to get started.</p>
          <Button onClick={() => setShowNew(true)} className="mt-4 gap-2">
            <Plus className="h-4 w-4" /> Create inbox
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <AnimatePresence>
            {inboxes.map((inbox) => (
              <motion.div
                key={inbox.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={cn(
                  'relative rounded-xl border bg-card p-4 transition-colors cursor-pointer',
                  activeInboxId === inbox.id ? 'border-primary border-2 shadow-md shadow-emerald-500/10' : 'border-border/60 hover:border-border'
                )}
                onClick={() => handleSwitch(inbox.id)}
              >
                {activeInboxId === inbox.id && (
                  <span className="absolute top-3 right-3">
                    <Badge className="bg-primary text-primary-foreground text-[10px] gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" /> Active
                    </Badge>
                  </span>
                )}

                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-white">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{inbox.isCustom ? <Sparkles className="h-3 w-3" /> : <Zap className="h-3 w-3" />}</span>
                      {inbox.burnOnRead && <Flame className="h-3 w-3 text-orange-500" />}
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{inbox.isCustom ? 'Custom' : 'Random'}</span>
                    </div>
                    <p className="mt-0.5 font-mono text-sm font-semibold break-all leading-tight">{inbox.email}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <CountdownTimer expiresAt={inbox.expiresAt} variant="compact" onExpire={() => removeInbox(inbox.id)} />
                  <span className="text-xs text-muted-foreground">
                    {inbox._count?.messages || 0} {(inbox._count?.messages || 0) === 1 ? 'message' : 'messages'}
                  </span>
                </div>

                {/* Action row */}
                <div className="mt-3 flex items-center gap-1.5 border-t border-border/40 pt-3" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => copyEmail(inbox)}>
                    {copiedId === inbox.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copiedId === inbox.id ? 'Copied' : 'Copy'}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => extendMutation.mutate({ id: inbox.id, mins: 10 })}>
                    <Clock className="h-3 w-3" /> +10m
                  </Button>
                  <div className="flex-1" />
                  <Button
                    size="sm" variant="ghost" className="h-7 gap-1 text-xs"
                    onClick={() => handleSwitch(inbox.id)}
                  >
                    Open <ChevronRight className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/10"
                    onClick={() => { if (confirm('Delete this inbox?')) deleteMutation.mutate(inbox.id) }}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Quick new inbox dialog */}
      <QuickNewDialog
        open={showNew}
        onOpenChange={setShowNew}
        domains={domainsData?.domains || []}
        lifetimeOptions={domainsData?.lifetimeOptions || []}
        onCreated={(inbox) => {
          setShowNew(false)
          // upsert + set active
          queryClient.invalidateQueries({ queryKey: ['inboxes'] })
          queryClient.invalidateQueries({ queryKey: ['stats'] })
          setActiveInboxId(inbox.id)
          setMessages([])
          setActiveSection('inbox')
          toast.success('Inbox created', { description: inbox.email })
        }}
      />
    </div>
  )
}

function QuickNewDialog({
  open, onOpenChange, domains, lifetimeOptions, onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  domains: Array<{ domain: string; label: string; badge: string; popular: boolean }>
  lifetimeOptions: Array<{ value: number; label: string; default?: boolean }>
  onCreated: (inbox: Inbox) => void
}) {
  const [domain, setDomain] = useState(domains[0]?.domain || 'studentbox.in')
  const [lifetime, setLifetime] = useState(lifetimeOptions.find(o => o.default)?.value || 10)
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: () => api.createInbox({ domain, lifetimeMinutes: lifetime }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inboxes'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      onCreated(data.inbox)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4 text-emerald-500" /> New random address</DialogTitle>
          <DialogDescription>Generate a fresh disposable inbox in seconds.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Domain</Label>
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {domains.map((d) => (
                  <SelectItem key={d.domain} value={d.domain}>
                    @{d.domain} {d.badge && <span className="text-xs text-emerald-500 ml-1">{d.badge}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            Need a custom local-part? Use the "Customize" button on the Inbox tab.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="gap-2">
            {createMutation.isPending ? <Zap className="h-4 w-4 animate-pulse" /> : <Plus className="h-4 w-4" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

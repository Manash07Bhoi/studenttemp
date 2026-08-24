'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AtSign, Plus, Trash2, Mail, Sparkles, Zap, Flame, Copy, Check, ChevronRight, Clock, GripVertical,
} from 'lucide-react'
import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

const REORDER_LS_KEY = 'studenttemp_inbox_order'

function loadOrder(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(REORDER_LS_KEY) || '[]') } catch { return [] }
}
function saveOrder(ids: string[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(REORDER_LS_KEY, JSON.stringify(ids))
}

export function AddressesSection({ triggerGenerate: _triggerGenerate }: { triggerGenerate: (email: string) => void }) {
  const inboxes = useAppStore((s) => s.inboxes)
  const activeInboxId = useAppStore((s) => s.activeInboxId)
  const setActiveInboxId = useAppStore((s) => s.setActiveInboxId)
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const removeInbox = useAppStore((s) => s.removeInbox)
  const updateInbox = useAppStore((s) => s.updateInbox)
  const setInboxes = useAppStore((s) => s.setInboxes)
  const setMessages = useAppStore((s) => s.setMessages)
  const queryClient = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [order, setOrder] = useState<string[]>([])

  // Load saved order on mount
  useEffect(() => { setOrder(loadOrder()) }, [])

  // Sort inboxes by saved order (any not in the order go last, preserving their natural order)
  const sortedInboxes = useMemo(() => {
    if (order.length === 0) return inboxes
    const orderMap = new Map(order.map((id, i) => [id, i]))
    return [...inboxes].sort((a, b) => {
      const ai = orderMap.get(a.id) ?? 9999
      const bi = orderMap.get(b.id) ?? 9999
      return ai - bi
    })
  }, [inboxes, order])

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sortedInboxes.findIndex((i) => i.id === active.id)
    const newIndex = sortedInboxes.findIndex((i) => i.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const newOrder = arrayMove(sortedInboxes, oldIndex, newIndex)
    const newIds = newOrder.map((i) => i.id)
    setOrder(newIds)
    saveOrder(newIds)
    setInboxes(newOrder)
    toast.success('Inbox order updated', { duration: 1200 })
  }, [sortedInboxes, setInboxes])

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
        <div className="space-y-3">
          {/* Drag-to-reorder hint */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <GripVertical className="h-3.5 w-3.5" />
            <span>Drag the handle to reorder your inboxes</span>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <SortableContext items={sortedInboxes.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <AnimatePresence>
                  {sortedInboxes.map((inbox) => (
                    <SortableInboxCard
                      key={inbox.id}
                      inbox={inbox}
                      isActive={activeInboxId === inbox.id}
                      copiedId={copiedId}
                      onSwitch={() => handleSwitch(inbox.id)}
                      onCopy={() => copyEmail(inbox)}
                      onExtend={() => extendMutation.mutate({ id: inbox.id, mins: 10 })}
                      onDelete={() => { if (confirm('Delete this inbox?')) deleteMutation.mutate(inbox.id) }}
                      onExpire={() => removeInbox(inbox.id)}
                      messageCount={inbox._count?.messages || 0}
                    />
                  ))}
                </AnimatePresence>
              </SortableContext>
            </div>
          </DndContext>
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
              <SelectContent className="max-h-[300px]">
                {(() => {
                  const packs: Record<string, string> = {
                    indian_student: '🇮🇳 India Student',
                    standard: '🇮🇳 India General',
                    international: '🌍 International',
                    privacy: '🔒 Privacy',
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

// ---------- Sortable Inbox Card ----------
function SortableInboxCard({
  inbox, isActive, copiedId, onSwitch, onCopy, onExtend, onDelete, onExpire, messageCount,
}: {
  inbox: Inbox
  isActive: boolean
  copiedId: string | null
  onSwitch: () => void
  onCopy: () => void
  onExtend: () => void
  onDelete: () => void
  onExpire: () => void
  messageCount: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: inbox.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  }

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        'relative rounded-xl border bg-card p-4 transition-colors',
        isActive ? 'border-primary border-2 shadow-md shadow-emerald-500/10' : 'border-border/60 hover:border-border',
        isDragging && 'shadow-2xl shadow-emerald-500/20 ring-2 ring-emerald-500/40'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 grid h-7 w-5 place-items-center text-muted-foreground/40 hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {isActive && (
        <span className="absolute top-3 right-3">
          <Badge className="bg-primary text-primary-foreground text-[10px] gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" /> Active
          </Badge>
        </span>
      )}

      <div className="flex items-start gap-3 pl-6 cursor-pointer" onClick={onSwitch}>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-white">
          <Mail className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{inbox.isCustomAlias ? <Sparkles className="h-3 w-3" /> : <Zap className="h-3 w-3" />}</span>
            {inbox.burnOnRead && <Flame className="h-3 w-3 text-orange-500" />}
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{inbox.isCustomAlias ? 'Custom' : 'Random'}</span>
          </div>
          <p className="mt-0.5 font-mono text-sm font-semibold break-all leading-tight">{inbox.email}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between pl-6">
        <CountdownTimer expiresAt={inbox.expiresAt} variant="compact" onExpire={onExpire} />
        <span className="text-xs text-muted-foreground">
          {messageCount} {messageCount === 1 ? 'message' : 'messages'}
        </span>
      </div>

      {/* Action row */}
      <div className="mt-3 flex items-center gap-1.5 border-t border-border/40 pt-3 pl-6" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onCopy}>
          {copiedId === inbox.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copiedId === inbox.id ? 'Copied' : 'Copy'}
        </Button>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={onExtend}>
          <Clock className="h-3 w-3" /> +10m
        </Button>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={onSwitch}>
          Open <ChevronRight className="h-3 w-3" />
        </Button>
        <Button
          size="sm" variant="ghost"
          className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/10"
          onClick={onDelete}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>
  )
}

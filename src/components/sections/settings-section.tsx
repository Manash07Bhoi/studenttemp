'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Settings as SettingsIcon, Moon, Sun, Bell, Volume2, Trash2, Download,
  ShieldCheck, Github, Heart, Clock, AtSign, Flame, Palette, Database, AlertTriangle,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'

// Local-only settings (persisted to localStorage — no account needed)
const LS_KEY = 'studenttemp_settings'
interface LocalSettings {
  soundEnabled: boolean
  autoDeleteOnRead: boolean
  defaultLifetime: number
  defaultDomain: string
  burnOnRead: boolean
  reduceMotion: boolean
  compactMessageList: boolean
}

const DEFAULT_SETTINGS: LocalSettings = {
  soundEnabled: false,
  autoDeleteOnRead: false,
  defaultLifetime: 10,
  defaultDomain: 'studentbox.in',
  burnOnRead: false,
  reduceMotion: false,
  compactMessageList: false,
}

function loadSettings(): LocalSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(s: LocalSettings) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify(s))
}

export function SettingsSection({ triggerGenerate: _triggerGenerate }: { triggerGenerate: (email: string) => void }) {
  const [settings, setSettings] = useState<LocalSettings>(DEFAULT_SETTINGS)
  const inboxes = useAppStore((s) => s.inboxes)
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const queryClient = useQueryClient()

  const { data: domainsData } = useQuery({ queryKey: ['domains'], queryFn: api.getDomains, staleTime: Infinity })
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: api.getStats, refetchInterval: 30_000 })

  useEffect(() => {
    setSettings(loadSettings())
  }, [])

  const update = (patch: Partial<LocalSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
    toast.success('Settings saved', { duration: 1500 })
  }

  const clearAllInboxes = async () => {
    if (!confirm(`Delete all ${inboxes.length} active inbox(es)? This cannot be undone.`)) return
    for (const inbox of inboxes) {
      try {
        await api.deleteInbox(inbox.id)
      } catch (e) {
        // ignore
      }
    }
    queryClient.invalidateQueries({ queryKey: ['inboxes'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
    toast.success('All inboxes cleared')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-emerald-500" /> Settings
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Preferences are saved locally to your browser. No account required.
        </p>
      </div>

      {/* Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-emerald-500" /> New inbox defaults</CardTitle>
          <CardDescription>Applied when generating a new random inbox.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default lifetime</Label>
              <Select value={String(settings.defaultLifetime)} onValueChange={(v) => update({ defaultLifetime: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {domainsData?.lifetimeOptions.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default domain</Label>
              <Select value={settings.defaultDomain} onValueChange={(v) => update({ defaultDomain: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {domainsData?.domains.map((d) => (
                    <SelectItem key={d.domain} value={d.domain}>@{d.domain}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <SettingRow
            icon={<Flame className="h-4 w-4 text-orange-500" />}
            title="Burn-on-read by default"
            desc="New inboxes auto-expire 60 seconds after the first message is read."
          >
            <Switch checked={settings.burnOnRead} onCheckedChange={(v) => update({ burnOnRead: v })} />
          </SettingRow>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4 text-emerald-500" /> Notifications & feedback</CardTitle>
          <CardDescription>Control how the app alerts you to new mail.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow
            icon={<Volume2 className="h-4 w-4" />}
            title="Sound on new message"
            desc="Play a soft chime when mail arrives. Off by default."
          >
            <Switch checked={settings.soundEnabled} onCheckedChange={(v) => update({ soundEnabled: v })} />
          </SettingRow>
          <SettingRow
            icon={<Palette className="h-4 w-4" />}
            title="Reduce motion"
            desc="Disable scramble, slide, and reveal animations."
          >
            <Switch checked={settings.reduceMotion} onCheckedChange={(v) => update({ reduceMotion: v })} />
          </SettingRow>
          <SettingRow
            icon={<AtSign className="h-4 w-4" />}
            title="Compact message list"
            desc="Show more messages per screen with denser rows."
          >
            <Switch checked={settings.compactMessageList} onCheckedChange={(v) => update({ compactMessageList: v })} />
          </SettingRow>
        </CardContent>
      </Card>

      {/* Data & privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-emerald-500" /> Data & privacy</CardTitle>
          <CardDescription>Manage your data. We don't track you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Active inboxes" value={stats?.session.activeInboxes ?? 0} />
            <Stat label="Total created" value={stats?.session.totalInboxes ?? 0} />
            <Stat label="Messages received" value={stats?.session.totalMessages ?? 0} />
            <Stat label="Unread" value={stats?.session.unreadMessages ?? 0} />
          </div>

          <SettingRow
            icon={<Trash2 className="h-4 w-4 text-red-500" />}
            title="Clear all active inboxes"
            desc="Immediately delete all inboxes and their messages."
            danger
          >
            <Button variant="outline" size="sm" className="text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={clearAllInboxes} disabled={inboxes.length === 0}>
              Clear ({inboxes.length})
            </Button>
          </SettingRow>

          <SettingRow
            icon={<Download className="h-4 w-4" />}
            title="Export data"
            desc="Download all your inbox metadata and messages as JSON."
          >
            <Button variant="outline" size="sm" onClick={() => exportData()}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export
            </Button>
          </SettingRow>
        </CardContent>
      </Card>

      {/* FAQ accordion */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Frequently asked</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="q1">
              <AccordionTrigger className="text-sm">Is this really anonymous?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Yes. We never ask for your name, email, or phone. A random session ID is stored in a cookie so you can manage your inboxes across refreshes — that's it. No IP logging beyond standard rate-limiting.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2">
              <AccordionTrigger className="text-sm">Can I receive real email here?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                In production, StudentTemp runs a real SMTP receiver. This demo generates realistic incoming mail (OTP codes, registration confirmations, newsletters) on a schedule so you can experience the full flow without a real mail server.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q3">
              <AccordionTrigger className="text-sm">What happens when an inbox expires?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                The inbox and all its messages are permanently deleted from our database. Custom local-parts enter a 5-minute cooldown before anyone else can claim them, to prevent targeted hijacking of "waited-for" addresses.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q4">
              <AccordionTrigger className="text-sm">Should I use this for important accounts?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span>No. Anyone who knows the address can read the mail. Use it for one-time verifications, throwaway sign-ups, and testing — never for banking, primary email, or anything tied to your real identity.</span>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* About footer */}
      <div className="rounded-xl border border-border/60 bg-muted/40 p-5 text-center">
        <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-foreground/80">
          Built with <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" /> for students & developers
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">StudentTemp · Privacy-first disposable email · No tracking, no sign-up</p>
      </div>
    </div>
  )
}

function SettingRow({
  icon, title, desc, danger, children,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${danger ? 'bg-red-500/10' : 'bg-muted'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium leading-tight">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</div>
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3.5 border border-border/30">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  )
}

async function exportData() {
  try {
    const [inboxesRes, statsRes] = await Promise.all([api.listInboxes(), api.getStats()])
    const exportObj = {
      exportedAt: new Date().toISOString(),
      stats: statsRes,
      inboxes: inboxesRes.inboxes,
      notes: 'StudentTemp data export. Inboxes and messages are also stored on the server until they expire.',
    }
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `studenttemp-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Data exported')
  } catch (e) {
    toast.error('Export failed')
  }
}

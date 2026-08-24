'use client'

// AnalyticsSection — REAL usage analytics for the current session.
//
// Fetches aggregated stats from /api/analytics (computed server-side from real
// Message rows). Renders:
//   • Stats grid (total messages, inboxes, avg/inbox, auth pass rate, total data)
//   • Area chart of messages per day (last N days) — emerald gradient fill
//   • Donut chart of messages by category (otp/registration/...)
//   • Horizontal bar chart of top 10 senders
//   • Auth results panel (SPF / DKIM / DMARC — pass / fail / none)
//
// All charts use Recharts. Loading = shimmer skeletons matching chart shapes.
// Empty = friendly illustration + CTA. Error = retry button.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import {
  BarChart3, TrendingUp, Mail, Activity, Shield, ShieldCheck, ShieldAlert,
  RefreshCw, Inbox, Clock, Database, Gauge, PieChart as PieIcon, AlertCircle,
  Sparkles,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import type { AnalyticsResponse } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

// Per-category hex colors for charts (NO indigo/blue per brand rules).
const CATEGORY_COLORS: Record<string, string> = {
  otp: '#8b5cf6',          // violet-500
  registration: '#10b981', // emerald-500
  newsletter: '#06b6d4',   // cyan-500
  social: '#f43f5e',       // rose-500
  shopping: '#f59e0b',     // amber-500
  security: '#0d9488',    // teal-600
  general: '#64748b',     // slate-500
}

const BRAND_EMERALD = '#10b981'
const BRAND_CYAN = '#06b6d4'

// Hook to get theme-aware SVG colors (CSS vars don't resolve in SVG attributes reliably)
function useSvgColors() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return {
    border: isDark ? '#334155' : '#e2e8f0',
    muted: isDark ? '#94a3b8' : '#64748b',
    bg: isDark ? '#1e293b' : '#ffffff',
  }
}

const RANGES: { value: string; days: number; label: string }[] = [
  { value: '7', days: 7, label: '7 days' },
  { value: '14', days: 14, label: '14 days' },
  { value: '30', days: 30, label: '30 days' },
]

// ---------- helpers ----------

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const v = bytes / Math.pow(1024, i)
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatHour(h: number): string {
  if (h === 0) return '12 AM'
  if (h === 12) return '12 PM'
  if (h < 12) return `${h} AM`
  return `${h - 12} PM`
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(rate === 1 ? 0 : 1)}%`
}

// ---------- component ----------

export function AnalyticsSection({ triggerGenerate: _triggerGenerate }: { triggerGenerate: (email: string) => void }) {
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const [range, setRange] = useState('14')
  const rangeDays = Number(range)

  const { data, isLoading, isError, error, refetch } = useQuery<AnalyticsResponse>({
    queryKey: ['analytics', rangeDays],
    queryFn: () => api.getAnalytics(rangeDays),
    staleTime: 30_000,
  })

  const isEmpty = !isLoading && !isError && (data?.totalMessages ?? 0) === 0

  return (
    <div className="space-y-6">
      {/* Header + range selector */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-500" /> Analytics
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Real-time insight into your disposable-mail traffic — computed from your actual messages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">Range</span>
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={(v) => { if (v) setRange(v) }}
            variant="outline"
            size="sm"
            className="rounded-lg border border-border/60 bg-card"
            aria-label="Time range"
          >
            {RANGES.map((r) => (
              <ToggleGroupItem
                key={r.value}
                value={r.value}
                aria-label={`${r.days} days`}
                className="px-3 py-1.5 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {r.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {isLoading && <AnalyticsSkeleton />}

      {isError && (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center justify-center text-center py-12 gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold">Couldn&apos;t load analytics</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                {error instanceof Error ? error.message : 'An unexpected error occurred.'}
              </p>
            </div>
            <Button onClick={() => refetch()} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {isEmpty && <AnalyticsEmptyState onCreateInbox={() => setActiveSection('inbox')} />}

      {!isLoading && !isError && !isEmpty && data && <AnalyticsBody data={data} />}
    </div>
  )
}

// ---------- body ----------

function AnalyticsBody({ data }: { data: AnalyticsResponse }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          icon={<Mail className="h-4 w-4" />}
          label="Messages"
          value={String(data.totalMessages)}
          accent="emerald"
          hint={`in ${data.rangeDays} days`}
        />
        <StatCard
          icon={<Inbox className="h-4 w-4" />}
          label="Inboxes"
          value={String(data.totalInboxes)}
          accent="cyan"
          hint={`${data.activeInboxes} active`}
        />
        <StatCard
          icon={<Gauge className="h-4 w-4" />}
          label="Avg / inbox"
          value={data.avgMessagesPerInbox.toFixed(1)}
          accent="violet"
          hint="messages"
        />
        <StatCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Auth pass"
          value={formatPct(data.authPassRate)}
          accent="emerald"
          hint="SPF + DKIM + DMARC"
        />
        <StatCard
          icon={<Database className="h-4 w-4" />}
          label="Data received"
          value={formatBytes(data.totalBytes)}
          accent="amber"
          hint={`avg ${formatBytes(data.avgMessageBytes)}/msg`}
        />
      </div>

      {/* Charts row 1: area (per day) — full width */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Messages per day
          </CardTitle>
          <CardDescription>
            Last {data.rangeDays} days · {data.perDay.reduce((a, b) => a + b.count, 0)} total
            {data.peakHour && <> · peak at {formatHour(data.peakHour.hour)} ({data.peakHour.count})</>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AreaChartContainer data={data.perDay} />
        </CardContent>
      </Card>

      {/* Charts row 2: donut (category) + auth panel side-by-side on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PieIcon className="h-4 w-4 text-cyan-500" />
              By category
            </CardTitle>
            <CardDescription>Distribution across inbox categories</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryDonut data={data.byCategory} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-emerald-500" />
              Authentication results
            </CardTitle>
            <CardDescription>SPF / DKIM / DMARC breakdown of all received messages</CardDescription>
          </CardHeader>
          <CardContent>
            <AuthPanel auth={data.auth} total={data.totalMessages} />
          </CardContent>
        </Card>
      </div>

      {/* Charts row 3: top senders bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-emerald-500" />
            Top senders
          </CardTitle>
          <CardDescription>Top 10 sender addresses by message count</CardDescription>
        </CardHeader>
        <CardContent>
          <TopSendersChart data={data.topSenders} />
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ---------- stat card ----------

const ACCENT_BG: Record<string, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

function StatCard({
  icon, label, value, hint, accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  accent: 'emerald' | 'cyan' | 'violet' | 'amber'
}) {
  return (
    <Card className="gap-3 py-4">
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className={cn('grid h-7 w-7 place-items-center rounded-lg', ACCENT_BG[accent])}>
            {icon}
          </span>
        </div>
        <div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  )
}

// ---------- area chart: messages per day ----------

function AreaChartContainer({ data }: { data: AnalyticsResponse['perDay'] }) {
  const gradientId = 'analytics-area-emerald'
  const svg = useSvgColors()
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND_EMERALD} stopOpacity={0.45} />
              <stop offset="100%" stopColor={BRAND_EMERALD} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={svg.border} strokeOpacity={0.6} vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: svg.muted, fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: svg.muted, fontSize: 11 }}
            width={32}
          />
          <Tooltip
            cursor={{ stroke: svg.border, strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null
              return (
                <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 shadow-md">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-0.5 text-sm font-semibold flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: BRAND_EMERALD }} />
                    {payload[0].value as number} messages
                  </div>
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={BRAND_EMERALD}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={{ r: 2.5, fill: BRAND_EMERALD, strokeWidth: 0 }}
            activeDot={{ r: 4.5, fill: BRAND_EMERALD, stroke: svg.bg, strokeWidth: 2 }}
            isAnimationActive
            animationDuration={650}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------- donut chart: by category ----------

function CategoryDonut({ data }: { data: AnalyticsResponse['byCategory'] }) {
  const total = data.reduce((a, b) => a + b.count, 0)
  const svg = useSvgColors()

  if (data.length === 0) {
    return (
      <div className="grid h-[260px] place-items-center text-sm text-muted-foreground">
        No category data
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
      <div className="relative h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={2}
              stroke={svg.bg}
              strokeWidth={2}
              isAnimationActive
              animationDuration={650}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.category}
                  fill={CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.general}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null
                const p = payload[0]
                const count = p.value as number
                const pct = total > 0 ? (count / total) * 100 : 0
                return (
                  <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 shadow-md">
                    <div className="text-sm font-semibold flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: (p.payload && CATEGORY_COLORS[(p.payload as { category?: string }).category || '']) || CATEGORY_COLORS.general }}
                      />
                      {(p.payload as { label?: string }).label || p.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {count} messages · {pct.toFixed(1)}%
                    </div>
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums">{total}</span>
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">messages</span>
        </div>
      </div>

      {/* Legend with counts */}
      <ul className="space-y-1.5 max-h-[220px] overflow-y-auto scrollbar-thin pr-1">
        {data.map((entry) => {
          const pct = total > 0 ? (entry.count / total) * 100 : 0
          const color = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.general
          return (
            <li key={entry.category} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: color }} />
              <span className="flex-1 truncate">{entry.label}</span>
              <span className="tabular-nums text-muted-foreground">{entry.count}</span>
              <span className="tabular-nums text-xs text-muted-foreground w-12 text-right">{pct.toFixed(0)}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------- auth panel: SPF / DKIM / DMARC breakdown ----------

function AuthPanel({
  auth,
  total,
}: {
  auth: AnalyticsResponse['auth']
  total: number
}) {
  return (
    <div className="space-y-4">
      <AuthRow label="SPF" row={auth.spf} total={total} />
      <AuthRow label="DKIM" row={auth.dkim} total={total} />
      <AuthRow label="DMARC" row={auth.dmarc} total={total} />

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60">
        <AuthLegend color="#10b981" icon={<ShieldCheck className="h-3 w-3" />} label="Pass" />
        <AuthLegend color="#f43f5e" icon={<ShieldAlert className="h-3 w-3" />} label="Fail" />
        <AuthLegend color="#94a3b8" icon={<Clock className="h-3 w-3" />} label="None" />
      </div>
    </div>
  )
}

function AuthRow({
  label, row, total,
}: {
  label: string
  row: AnalyticsResponse['auth']['spf']
  total: number
}) {
  const passPct = total > 0 ? (row.pass / total) * 100 : 0
  const failPct = total > 0 ? (row.fail / total) * 100 : 0
  const nonePct = total > 0 ? (row.none / total) * 100 : 0

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="font-semibold flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
        </span>
        <span className="tabular-nums text-xs text-muted-foreground">
          {row.pass} pass · {row.fail} fail · {row.none} none
        </span>
      </div>
      <div className="relative h-3 w-full rounded-full overflow-hidden bg-muted flex">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{ width: `${passPct}%`, background: '#10b981' }}
          aria-label={`${label} pass: ${row.pass}`}
        />
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{ width: `${failPct}%`, background: '#f43f5e' }}
          aria-label={`${label} fail: ${row.fail}`}
        />
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{ width: `${nonePct}%`, background: '#94a3b8' }}
          aria-label={`${label} none: ${row.none}`}
        />
      </div>
    </div>
  )
}

function AuthLegend({ color, icon, label }: { color: string; icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
      <span className="grid h-4 w-4 place-items-center rounded-sm" style={{ background: color, color: '#fff' }}>
        {icon}
      </span>
      {label}
    </div>
  )
}

// ---------- top senders bar chart ----------

function TopSendersChart({ data }: { data: AnalyticsResponse['topSenders'] }) {
  const svg = useSvgColors()
  if (data.length === 0) {
    return (
      <div className="grid h-[260px] place-items-center text-sm text-muted-foreground">
        No sender data
      </div>
    )
  }

  // Truncate long addresses for the Y axis
  const chartData = data.map((d) => ({
    ...d,
    short: d.sender.length > 28 ? d.sender.slice(0, 25) + '…' : d.sender,
  }))

  return (
    <div className="h-[Math.max(220, data.length * 36)] w-full" style={{ height: Math.max(220, data.length * 36) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        >
          <defs>
            <linearGradient id="analytics-bar-emerald" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={BRAND_EMERALD} stopOpacity={0.55} />
              <stop offset="100%" stopColor={BRAND_EMERALD} stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={svg.border} strokeOpacity={0.6} horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: svg.muted, fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="short"
            tickLine={false}
            axisLine={false}
            width={180}
            tick={{ fill: svg.muted, fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', fillOpacity: 0.4 }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null
              const p = payload[0].payload as { sender: string; count: number }
              return (
                <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 shadow-md max-w-[280px]">
                  <div className="text-xs text-muted-foreground truncate">{p.sender}</div>
                  <div className="mt-0.5 text-sm font-semibold flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: BRAND_EMERALD }} />
                    {p.count} messages
                  </div>
                </div>
              )
            }}
          />
          <Bar
            dataKey="count"
            fill="url(#analytics-bar-emerald)"
            radius={[0, 4, 4, 0]}
            isAnimationActive
            animationDuration={650}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------- empty state ----------

function AnalyticsEmptyState({ onCreateInbox }: { onCreateInbox: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center text-center py-16 gap-4">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-emerald-500/15 to-cyan-500/15 text-emerald-500"
        >
          <BarChart3 className="h-9 w-9" />
          <span className="absolute -top-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
        </motion.div>
        <div>
          <h3 className="font-semibold text-lg">No data yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Generate an inbox and receive some mail to see analytics. Charts will populate
            automatically as real messages arrive.
          </p>
        </div>
        <Button onClick={onCreateInbox} className="gap-2">
          <Inbox className="h-4 w-4" /> Generate an inbox
        </Button>
      </CardContent>
    </Card>
  )
}

// ---------- loading skeleton ----------

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row skeletons */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>

      {/* Area chart skeleton */}
      <div className="rounded-xl border border-border/60 bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-7 w-7 rounded-lg" />
        </div>
        <div className="h-[260px] w-full rounded-lg shimmer bg-muted/40" />
      </div>

      {/* Donut + auth panel skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <Skeleton className="h-4 w-32 mb-4" />
          <div className="h-[220px] w-[220px] mx-auto rounded-full shimmer bg-muted/40" />
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-6">
          <Skeleton className="h-4 w-48 mb-4" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top senders skeleton */}
      <div className="rounded-xl border border-border/60 bg-card p-6">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="h-[260px] w-full rounded-lg shimmer bg-muted/40" />
      </div>
    </div>
  )
}

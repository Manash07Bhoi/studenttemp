'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
// react-syntax-highlighter ships without bundled .d.ts files; with allowJs +
// noImplicitAny:false the module resolves to `any` and the build passes.
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { useTheme } from 'next-themes'
import {
  ArrowLeft, Printer, FileText, Scale, Flag, ShieldCheck,
  AlertCircle, ChevronRight, Calendar, Mail, ScrollText,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore, type SectionId } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Document registry — drives the TOC sidebar + mobile <select>
// ---------------------------------------------------------------------------
const LEGAL_DOCS = [
  { id: 'privacy',        label: 'Privacy Policy',     icon: ShieldCheck,  desc: 'Data collection & lifecycle' },
  { id: 'terms',          label: 'Terms of Service',   icon: Scale,        desc: 'Usage rules & liability' },
  { id: 'acceptable-use', label: 'Acceptable Use',     icon: FileText,     desc: 'Permitted & prohibited actions' },
  { id: 'abuse',          label: 'Abuse Policy',        icon: Flag,         desc: 'Reporting & consequences' },
] as const

type DocId = (typeof LEGAL_DOCS)[number]['id']

// ---------------------------------------------------------------------------
// Module-level previous-section tracker
// Zustand doesn't natively remember the section that was active before the
// current one. We subscribe once (browser-only, idempotent across HMR reloads)
// so the back arrow can return the user to where they came from (e.g. Settings,
// About, Inbox). Defaults to 'inbox' on a fresh tab.
// ---------------------------------------------------------------------------
let __prevSection: SectionId = 'inbox'
let __currentSection: SectionId = 'inbox'
if (typeof window !== 'undefined') {
  const w = window as unknown as { __studenttemp_nav_tracker__?: boolean }
  if (!w.__studenttemp_nav_tracker__) {
    w.__studenttemp_nav_tracker__ = true
    __currentSection = useAppStore.getState().activeSection
    useAppStore.subscribe((s) => {
      if (s.activeSection !== __currentSection) {
        __prevSection = __currentSection
        __currentSection = s.activeSection
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Markdown rendering — emerald/teal brand styling for every node type
// ---------------------------------------------------------------------------
function markdownComponents(isDark: boolean) {
  return {
    h1: ({ children }: any) => (
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4 text-foreground border-b border-border/60 pb-3">
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-lg sm:text-xl font-semibold mt-7 mb-2.5 flex items-center gap-2.5 text-foreground scroll-mt-36">
        <span className="h-4 w-1.5 rounded-full bg-gradient-to-b from-emerald-500 to-cyan-500 shrink-0" aria-hidden />
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-base font-semibold mt-4 mb-1.5 text-foreground scroll-mt-36">{children}</h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="text-xs font-semibold mt-4 mb-1.5 text-muted-foreground uppercase tracking-wider">
        {children}
      </h4>
    ),
    p: ({ children }: any) => (
      <p className="text-sm leading-relaxed mb-3 text-foreground/90">{children}</p>
    ),
    ul: ({ children }: any) => (
      <ul className="my-3 space-y-1.5 text-sm text-foreground/90 list-disc pl-5 marker:text-emerald-500">
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol className="my-3 space-y-1.5 text-sm text-foreground/90 list-decimal pl-5 marker:text-emerald-500 marker:font-semibold">
        {children}
      </ol>
    ),
    li: ({ children }: any) => <li className="leading-relaxed pl-1">{children}</li>,
    a: ({ href, children }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline underline-offset-2 break-words"
      >
        {children}
      </a>
    ),
    strong: ({ children }: any) => <strong className="font-semibold text-foreground">{children}</strong>,
    em: ({ children }: any) => <em className="italic">{children}</em>,
    code: ({ className, children }: any) => {
      const raw = Array.isArray(children) ? children.join('') : String(children ?? '')
      const text = raw.replace(/\n$/, '')
      const match = /language-(\w+)/.exec(className || '')
      // Block code = language fence OR multi-line content
      const isBlock = Boolean(match) || text.includes('\n')
      if (isBlock) {
        return (
          <SyntaxHighlighter
            language={match?.[1] || 'text'}
            style={(isDark ? oneDark : oneLight) as never}
            customStyle={{
              margin: '0.75rem 0',
              borderRadius: '0.5rem',
              fontSize: '0.85rem',
              padding: '1rem',
              border: '1px solid var(--border)',
            }}
          >
            {text}
          </SyntaxHighlighter>
        )
      }
      return (
        <code className="rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 text-[0.85em] font-mono border border-emerald-500/10 break-all">
          {children}
        </code>
      )
    },
    // pre wraps block code; we render the inner <code> via the custom code
    // component above, so just pass children through without an extra <pre>.
    pre: ({ children }: any) => <>{children}</>,
    blockquote: ({ children }: any) => (
      <blockquote className="my-4 border-l-4 border-emerald-500/60 bg-emerald-500/5 pl-4 pr-3 py-2.5 rounded-r-md text-sm text-foreground/80">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-6 border-border/60" />,
    table: ({ children }: any) => (
      <div className="my-4 overflow-x-auto rounded-md border border-border/60">
        <table className="w-full text-sm border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }: any) => <thead className="bg-muted/50">{children}</thead>,
    th: ({ children }: any) => (
      <th className="border-b border-border/60 px-3 py-2 font-semibold text-left text-foreground">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="border-t border-border/40 px-3 py-2 text-foreground/90">{children}</td>
    ),
  }
}

// ---------------------------------------------------------------------------
// Loading skeleton — matches the article layout for a smooth reveal
// ---------------------------------------------------------------------------
function LegalSkeleton() {
  return (
    <div className="space-y-4 py-2" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-3 w-1/4" />
      <div className="space-y-2 pt-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[95%]" />
        <Skeleton className="h-4 w-[82%]" />
      </div>
      <Skeleton className="h-5 w-1/3 mt-4" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[60%]" />
        <Skeleton className="h-4 w-[40%]" />
        <Skeleton className="h-4 w-[55%]" />
      </div>
      <Skeleton className="h-5 w-1/4 mt-4" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[88%]" />
      </div>
      <span className="sr-only">Loading document…</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function LegalSection({ triggerGenerate: _triggerGenerate }: { triggerGenerate: (email: string) => void }) {
  const sectionParams = useAppStore((s) => s.sectionParams)
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Validate the requested doc id; fall back to privacy for unknown values.
  const doc: DocId = (
    LEGAL_DOCS.some((d) => d.id === sectionParams.doc) ? sectionParams.doc : 'privacy'
  ) as DocId

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['legal', doc],
    queryFn: () => api.getLegal(doc),
    staleTime: Infinity,
  })

  const activeDocMeta = LEGAL_DOCS.find((d) => d.id === doc)!
  const components = useMemo(() => markdownComponents(isDark), [isDark])

  const handleBack = () => {
    const target: SectionId =
      __prevSection && __prevSection !== 'legal' ? __prevSection : 'inbox'
    setActiveSection(target)
  }

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print()
  }

  const handleSelectDoc = (id: string) => {
    setActiveSection('legal', { doc: id })
  }

  const ActiveIcon = activeDocMeta.icon

  return (
    <div className="space-y-4 sm:space-y-6 print:space-y-2">
      {/* ---------------------------------------------------------------- */}
      {/* Sticky in-page header (sits below the app shell header)           */}
      {/* ---------------------------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="sticky top-28 md:top-16 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/85 backdrop-blur-xl border-b border-border/60 print:static print:border-none print:bg-transparent print:py-0 print:-mx-0"
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 print:hidden"
            onClick={handleBack}
            aria-label="Back to previous section"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <ActiveIcon className="hidden sm:block h-4 w-4 text-emerald-500 shrink-0" aria-hidden />
              <h1 className="truncate text-base sm:text-lg font-bold leading-tight">
                {data?.title ?? activeDocMeta.label}
              </h1>
              <Badge
                variant="outline"
                className="hidden sm:inline-flex bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 print:hidden"
              >
                Legal
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Calendar className="h-3 w-3 shrink-0" aria-hidden />
              <span>Last updated {data?.updated ?? '…'}</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 print:hidden gap-1.5"
            onClick={handlePrint}
            aria-label="Print this document"
          >
            <Printer className="h-4 w-4" /> <span className="hidden sm:inline">Print</span>
          </Button>
        </div>

        {/* Mobile doc selector — replaces the desktop TOC sidebar */}
        <div className="mt-3 sm:hidden print:hidden">
          <Select value={doc} onValueChange={handleSelectDoc}>
            <SelectTrigger className="w-full" aria-label="Select legal document">
              <SelectValue placeholder="Select document" />
            </SelectTrigger>
            <SelectContent>
              {LEGAL_DOCS.map((d) => {
                const Icon = d.icon
                return (
                  <SelectItem key={d.id} value={d.id}>
                    <span className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-emerald-500" />
                      {d.label}
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* ---------------------------------------------------------------- */}
      {/* Body: TOC sidebar (desktop) + content card                       */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-[260px_1fr] print:block">
        {/* TOC sidebar — desktop only */}
        <aside className="hidden lg:block print:hidden" aria-label="Legal documents table of contents">
          <div className="sticky top-36">
            <div className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
              <div className="px-2 pb-2 mb-1 border-b border-border/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ScrollText className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                Documents
              </div>
              <nav className="space-y-0.5">
                {LEGAL_DOCS.map((d) => {
                  const active = d.id === doc
                  const Icon = d.icon
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleSelectDoc(d.id)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group w-full text-left rounded-lg px-2.5 py-2 transition-colors',
                        active
                          ? 'bg-emerald-500/10 ring-1 ring-emerald-500/20'
                          : 'hover:bg-accent/60'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            'grid h-7 w-7 place-items-center rounded-md shrink-0 transition-colors',
                            active
                              ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-sm shadow-emerald-500/30'
                              : 'bg-muted text-muted-foreground group-hover:text-foreground'
                          )}
                          aria-hidden
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div
                            className={cn(
                              'text-sm font-medium truncate',
                              active
                                ? 'text-foreground'
                                : 'text-muted-foreground group-hover:text-foreground'
                            )}
                          >
                            {d.label}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {d.desc}
                          </div>
                        </div>
                        {active && (
                          <ChevronRight
                            className="ml-auto h-3.5 w-3.5 text-emerald-500 shrink-0"
                            aria-hidden
                          />
                        )}
                      </div>
                    </button>
                  )
                })}
              </nav>
              <div className="mt-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-2.5 text-[11px] text-muted-foreground">
                <p className="flex items-center gap-1.5 font-medium text-foreground mb-0.5">
                  <Mail className="h-3 w-3 text-emerald-500" aria-hidden /> Questions?
                </p>
                Email{' '}
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  legal@studenttemp.example
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0">
          <Card className="print:border-none print:shadow-none print:bg-transparent">
            <CardContent>
              {isLoading && <LegalSkeleton />}

              {isError && (
                <Alert variant="destructive" className="print:hidden">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Couldn&apos;t load document</AlertTitle>
                  <AlertDescription className="flex flex-wrap items-center gap-2">
                    <span>
                      {(error as Error)?.message || 'Unknown error'} — please try
                      again.
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => refetch()}
                    >
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {data && !isLoading && !isError && (
                <motion.article
                  key={doc}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="max-w-none"
                >
                  <ReactMarkdown components={components}>{data.body}</ReactMarkdown>

                  {/* Footer meta */}
                  <div className="mt-8 pt-5 border-t border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground print:hidden">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3 w-3 text-emerald-500" aria-hidden />
                      Document:{' '}
                      <span className="font-medium text-foreground">{data.title}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3 w-3 text-emerald-500" aria-hidden />
                      Last updated {data.updated}
                    </span>
                  </div>
                </motion.article>
              )}

              {/* Empty state — server returned 200 but no body */}
              {data && !isLoading && !isError && !data.body && (
                <Alert>
                  <FileText className="h-4 w-4 text-emerald-500" />
                  <AlertTitle>This document is empty</AlertTitle>
                  <AlertDescription>
                    The requested document exists but has no published content yet.
                    Please check back later.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Mail, AlertCircle, CheckCircle2, Clock, RotateCcw, ChevronRight,
  Sparkles, Inbox as InboxIcon, Code2, FileText, Info, ShieldCheck, Zap,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

// --- Validation ---
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

const composeSchema = z.object({
  fromInboxId: z.string().min(1, 'Pick a sender inbox'),
  to: z
    .string()
    .trim()
    .min(1, 'Recipient is required')
    .refine((v) => EMAIL_RE.test(v), 'Enter a valid email address'),
  subject: z
    .string()
    .trim()
    .min(1, 'Subject is required')
    .max(200, 'Subject must be 200 characters or fewer'),
  text: z
    .string()
    .min(1, 'Body cannot be empty')
    .max(50_000, 'Body must be 50,000 characters or fewer'),
  html: z
    .string()
    .max(50_000, 'HTML body must be 50,000 characters or fewer')
    .optional()
    .or(z.literal('')),
})

type ComposeForm = z.infer<typeof composeSchema>

const SUBJECT_MAX = 200
const BODY_MAX = 50_000
const RATE_LIMIT_PER_HOUR = 5

interface SendResult {
  messageId: string
  response: string
  to: string
  from: string
  subject: string
  sentAt: string
}

export function ComposeSection({ triggerGenerate: _triggerGenerate }: { triggerGenerate: (email: string) => void }) {
  const inboxes = useAppStore((s) => s.inboxes)
  const activeInboxId = useAppStore((s) => s.activeInboxId)
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const [result, setResult] = useState<SendResult | null>(null)
  const [bodyTab, setBodyTab] = useState<'text' | 'html'>('text')

  const activeInboxes = useMemo(
    () => inboxes.filter((i) => i.status === 'active'),
    [inboxes]
  )

  const defaultFromId = activeInboxId && activeInboxes.some((i) => i.id === activeInboxId)
    ? activeInboxId
    : activeInboxes[0]?.id || ''

  const form = useForm<ComposeForm>({
    resolver: zodResolver(composeSchema),
    mode: 'onChange',
    defaultValues: {
      fromInboxId: defaultFromId,
      to: '',
      subject: '',
      text: '',
      html: '',
    },
  })

  // Keep `fromInboxId` in sync when active inbox changes or list updates
  useEffect(() => {
    if (!activeInboxes.length) return
    const current = form.getValues('fromInboxId')
    if (!current || !activeInboxes.some((i) => i.id === current)) {
      form.setValue('fromInboxId', activeInboxId || activeInboxes[0].id, {
        shouldValidate: true,
      })
    }
  }, [activeInboxId, activeInboxes, form])

  const {
    register, handleSubmit, setValue, reset, control, formState: { errors, isValid },
  } = form

  const subjectValue = useWatch({ control, name: 'subject' }) || ''
  const textValue = useWatch({ control, name: 'text' }) || ''
  const htmlValue = useWatch({ control, name: 'html' }) || ''
  const fromInboxId = useWatch({ control, name: 'fromInboxId' }) || ''

  const sendMutation = useMutation({
    mutationFn: (values: ComposeForm) =>
      api.sendMail({
        inboxId: values.fromInboxId,
        to: values.to.trim(),
        subject: values.subject.trim(),
        text: values.text,
        html: values.html && values.html.trim().length > 0 ? values.html : undefined,
      }),
    onSuccess: (data, vars) => {
      const fromInbox = activeInboxes.find((i) => i.id === vars.fromInboxId)
      setResult({
        messageId: data.messageId,
        response: data.response,
        to: vars.to.trim(),
        from: fromInbox?.email || '(unknown)',
        subject: vars.subject.trim(),
        sentAt: new Date().toISOString(),
      })
      toast.success('Mail sent', { description: `Delivered to ${vars.to.trim()}` })
    },
    onError: (err: Error) => {
      toast.error('Send failed', { description: err.message })
    },
  })

  const onSubmit = handleSubmit((values) => {
    sendMutation.mutate(values)
  })

  // ---- Derived UI bits ----
  const subjectLen = subjectValue.length
  const textLen = textValue.length
  const htmlLen = htmlValue.length
  const selectedInbox = activeInboxes.find((i) => i.id === fromInboxId)

  // ----- Empty state -----
  if (activeInboxes.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <Card className="border-dashed border-2 bg-card/50">
            <CardContent className="flex flex-col items-center justify-center text-center py-16 px-6">
              <div className="relative mb-5">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 blur-xl" />
                <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30">
                  <Mail className="h-8 w-8" />
                </div>
              </div>
              <h3 className="text-lg font-semibold">No active inboxes to send from</h3>
              <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
                You need at least one active disposable inbox before you can compose
                and send outbound mail. Generate one now — it takes a second.
              </p>
              <Button
                onClick={() => setActiveSection('inbox')}
                className="mt-6 gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:opacity-90"
              >
                <InboxIcon className="h-4 w-4" /> Create an inbox
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  // ----- Success state -----
  if (result) {
    return (
      <div className="space-y-6">
        <Header />
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <Card className="overflow-hidden border-emerald-500/30">
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-cyan-500" />
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">Mail sent successfully</CardTitle>
                  <CardDescription className="mt-1 truncate">
                    Delivered to <span className="font-medium text-foreground">{result.to}</span>
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="gap-1 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Sent
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="From">
                  <span className="font-mono text-sm break-all">{result.from}</span>
                </Field>
                <Field label="Subject">
                  <span className="text-sm font-medium line-clamp-2">{result.subject}</span>
                </Field>
                <Field label="Sent at">
                  <span className="font-mono text-sm">
                    {new Date(result.sentAt).toLocaleString()}
                  </span>
                </Field>
                <Field label="SMTP response">
                  <span className="font-mono text-sm">
                    {result.response || '(no response body)'}
                  </span>
                </Field>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                  <Code2 className="h-3.5 w-3.5" /> Message-ID (from SMTP server)
                </div>
                <code className="block font-mono text-xs text-foreground break-all">
                  {result.messageId}
                </code>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button
                  onClick={() => {
                    setResult(null)
                    reset({
                      fromInboxId: result.from === selectedInbox?.email ? fromInboxId : defaultFromId,
                      to: '',
                      subject: '',
                      text: '',
                      html: '',
                    })
                    setBodyTab('text')
                  }}
                  className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:opacity-90"
                >
                  <RotateCcw className="h-4 w-4" /> Send another
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActiveSection('messages')}
                  className="gap-2"
                >
                  <Mail className="h-4 w-4" /> View inbox
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  // ----- Compose form -----
  const sending = sendMutation.isPending

  return (
    <div className="space-y-6">
      <Header />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* ----- Compose card ----- */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Send className="h-4 w-4 text-emerald-500" />
                    New message
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Compose a real outbound email — submitted live via SMTP.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="gap-1 shrink-0">
                  <Clock className="h-3 w-3" />
                  {RATE_LIMIT_PER_HOUR}/hr
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                {/* Error banner */}
                <AnimatePresence>
                  {sendMutation.isError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Send failed</AlertTitle>
                        <AlertDescription>
                          {sendMutation.error?.message || 'Something went wrong. Please try again.'}
                        </AlertDescription>
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* From */}
                <div className="space-y-1.5">
                  <Label htmlFor="from-inbox" className="text-xs text-muted-foreground">
                    From
                  </Label>
                  <Select
                    value={fromInboxId}
                    onValueChange={(v) => setValue('fromInboxId', v, { shouldValidate: true })}
                  >
                    <SelectTrigger
                      id="from-inbox"
                      className="w-full font-mono"
                      aria-label="Select sender inbox"
                    >
                      <SelectValue placeholder="Pick a sender inbox" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeInboxes.map((inbox) => (
                        <SelectItem key={inbox.id} value={inbox.id}>
                          <span className="font-mono">{inbox.email}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.fromInboxId && (
                    <p className="text-xs text-destructive">{errors.fromInboxId.message}</p>
                  )}
                </div>

                {/* To */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="to" className="text-xs text-muted-foreground">
                      To
                    </Label>
                    {errors.to && <span className="text-xs text-destructive">{errors.to.message}</span>}
                  </div>
                  <Input
                    id="to"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="recipient@example.com"
                    aria-invalid={!!errors.to}
                    aria-describedby={errors.to ? 'to-error' : undefined}
                    className={cn('font-mono', errors.to && 'border-destructive/60')}
                    {...register('to')}
                  />
                </div>

                {/* Subject */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="subject" className="text-xs text-muted-foreground">
                      Subject
                    </Label>
                    <Counter value={subjectLen} max={SUBJECT_MAX} />
                  </div>
                  <Input
                    id="subject"
                    placeholder="Subject line"
                    aria-invalid={!!errors.subject}
                    className={cn(errors.subject && 'border-destructive/60')}
                    {...register('subject')}
                  />
                  {errors.subject && (
                    <p className="text-xs text-destructive">{errors.subject.message}</p>
                  )}
                </div>

                {/* Body (text + optional HTML) */}
                <div className="space-y-1.5">
                  <Tabs value={bodyTab} onValueChange={(v) => setBodyTab(v as 'text' | 'html')}>
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs text-muted-foreground">Body</Label>
                      <TabsList className="h-7">
                        <TabsTrigger value="text" className="gap-1 text-xs px-2.5">
                          <FileText className="h-3 w-3" /> Plain
                        </TabsTrigger>
                        <TabsTrigger value="html" className="gap-1 text-xs px-2.5">
                          <Code2 className="h-3 w-3" /> HTML
                          <span className="text-[10px] text-muted-foreground">(optional)</span>
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="text" className="mt-2">
                      <div className="relative">
                        <Textarea
                          id="body-text"
                          placeholder="Write your message here…"
                          aria-label="Plain text body"
                          className="min-h-[200px] resize-y font-mono text-sm leading-relaxed scrollbar-thin"
                          aria-invalid={!!errors.text}
                          {...register('text')}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Shown when the recipient's client doesn't render HTML.
                        </p>
                        <Counter value={textLen} max={BODY_MAX} />
                      </div>
                      {errors.text && (
                        <p className="mt-1 text-xs text-destructive">{errors.text.message}</p>
                      )}
                    </TabsContent>

                    <TabsContent value="html" className="mt-2">
                      <Textarea
                        id="body-html"
                        placeholder="<p>Optional HTML version of your message…</p>"
                        aria-label="HTML body (optional)"
                        className="min-h-[200px] resize-y font-mono text-xs leading-relaxed scrollbar-thin"
                        {...register('html')}
                      />
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Sent alongside the plain text body if provided.
                        </p>
                        <Counter value={htmlLen} max={BODY_MAX} />
                      </div>
                      {errors.html && (
                        <p className="mt-1 text-xs text-destructive">{errors.html.message}</p>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Submit */}
                <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      reset({
                        fromInboxId: defaultFromId,
                        to: '',
                        subject: '',
                        text: '',
                        html: '',
                      })
                      setBodyTab('text')
                    }}
                    disabled={sending}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" /> Clear
                  </Button>
                  <Button
                    type="submit"
                    disabled={sending || !isValid}
                    className="gap-2 sm:ml-auto bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? (
                      <>
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </motion.span>
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" /> Send mail
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* ----- Side info column ----- */}
        <motion.aside
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4"
        >
          {/* Selected sender card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-emerald-500" /> Sender
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {selectedInbox ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 text-white">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-semibold break-all leading-tight">
                        {selectedInbox.email}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {selectedInbox._count?.messages ?? selectedInbox.messageCount ?? 0} messages
                      </p>
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                    Real SMTP submission from this disposable address.
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No inbox selected.</p>
              )}
            </CardContent>
          </Card>

          {/* Rate limit / rules */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Sending rules
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2.5 text-xs text-muted-foreground">
              <Rule icon={<Clock className="h-3.5 w-3.5" />}>
                Rate limit: <strong className="text-foreground">{RATE_LIMIT_PER_HOUR}</strong> sends/hour per IP
              </Rule>
              <Rule icon={<Zap className="h-3.5 w-3.5" />}>
                Subject ≤ <strong className="text-foreground">{SUBJECT_MAX}</strong> chars
              </Rule>
              <Rule icon={<FileText className="h-3.5 w-3.5" />}>
                Body ≤ <strong className="text-foreground">50,000</strong> chars
              </Rule>
              <Rule icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                Outbound goes through real SMTP relay
              </Rule>
            </CardContent>
          </Card>

          {/* Tip */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-foreground font-medium">Tip:</span> If the
                recipient is on the same mail-service domain, the message is
                delivered instantly into that inbox.
              </p>
            </div>
          </div>
        </motion.aside>
      </div>
    </div>
  )
}

// ----- Small internal components -----

function Header() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
      <div className="flex-1">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 text-white">
            <Send className="h-4 w-4" />
          </span>
          Compose &amp; Send
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Send a real outbound email from one of your active inboxes to any
          external address — submitted live via SMTP.
        </p>
      </div>
      <Badge variant="outline" className="gap-1.5 self-start sm:self-end">
        <Sparkles className="h-3 w-3 text-emerald-500" />
        Real SMTP delivery
      </Badge>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div>{children}</div>
    </div>
  )
}

function Counter({ value, max }: { value: number; max: number }) {
  const ratio = value / max
  const color =
    ratio > 0.95 ? 'text-destructive' :
    ratio > 0.8 ? 'text-amber-500' :
    'text-muted-foreground'
  return (
    <span className={cn('text-[11px] font-mono tabular-nums', color)}>
      {value.toLocaleString()}/{max.toLocaleString()}
    </span>
  )
}

function Rule({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-emerald-500 mt-px">{icon}</span>
      <span className="leading-relaxed">{children}</span>
    </div>
  )
}

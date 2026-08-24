'use client'

import { motion } from 'framer-motion'
import {
  ShieldCheck, ShieldAlert, Zap, Lock, Eye, Clock, Trash2, Mail, Ban,
  CheckCircle2, Code, Github, Heart, ArrowRight, BookOpen, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'

export function AboutSection({ triggerGenerate: _triggerGenerate }: { triggerGenerate: (email: string) => void }) {
  const setActiveSection = useAppStore((s) => s.setActiveSection)

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-emerald-500/5 p-8 sm:p-12 text-center"
      >
        <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-48 w-96 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden />
        <div className="relative">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30">
            <Mail className="h-8 w-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Student<span className="text-gradient-brand">Temp</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            A privacy-first temporary email platform built for students, developers, and testers.
            Generate a disposable inbox in seconds, receive verification codes, and protect your real address — no sign-up, no tracking.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              <ShieldCheck className="h-3 w-3" /> No tracking
            </Badge>
            <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              <Zap className="h-3 w-3" /> Real-time
            </Badge>
            <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              <Lock className="h-3 w-3" /> Sanitized HTML
            </Badge>
            <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              <Clock className="h-3 w-3" /> Auto-expiring
            </Badge>
          </div>
          <Button className="mt-6 gap-2" onClick={() => setActiveSection('inbox')}>
            <Sparkles className="h-4 w-4" /> Create your first inbox
          </Button>
        </div>
      </motion.section>

      {/* Features grid */}
      <section>
        <h2 className="mb-4 text-lg font-bold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-emerald-500" /> What you get
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Zap className="h-5 w-5" />}
            title="Instant generation"
            desc="Random or custom local-parts across 5 student-themed domains. One click and you're live."
          />
          <FeatureCard
            icon={<Mail className="h-5 w-5" />}
            title="Real-time delivery"
            desc="New mail pushes to your screen the instant it arrives — no refresh, no polling."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Sanitized rendering"
            desc="External images, stylesheets, and scripts are stripped. Load them per-message if you trust the sender."
          />
          <FeatureCard
            icon={<Lock className="h-5 w-5" />}
            title="Auth results visible"
            desc="SPF, DKIM, and DMARC outcomes are shown for every message so you can spot spoofing."
          />
          <FeatureCard
            icon={<Clock className="h-5 w-5" />}
            title="Auto-expiry & extension"
            desc="Inboxes die on the timer. Extend by 10 minutes with one tap if you need more time."
          />
          <FeatureCard
            icon={<Eye className="h-5 w-5" />}
            title="Multi-inbox tray"
            desc="Run up to 5 inboxes at once. Switch between them instantly without losing context."
          />
        </div>
      </section>

      {/* How it works */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Code className="h-4 w-4 text-emerald-500" /> How it works</CardTitle>
            <CardDescription>The full lifecycle of a StudentTemp inbox.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-6 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-px before:bg-border">
              {[
                { t: 'Generate', d: 'You request a new inbox. The server picks a 10-character CSPRNG local-part (or validates your custom one) and creates a database row with an expiry timestamp.' },
                { t: 'Subscribe', d: 'Your browser opens a WebSocket connection to the mail service and subscribes to your inbox email. The connection stays live for instant push delivery.' },
                { t: 'Receive', d: 'When mail arrives (real SMTP in production, realistic generator in this demo), it is sanitized, persisted, and pushed to all your open tabs in real time.' },
                { t: 'Read', d: 'Open any message. The HTML body is rendered inside a sandboxed iframe with external resources blocked. Auth results (SPF/DKIM/DMARC) are displayed inline.' },
                { t: 'Expire', d: 'When the countdown hits zero, the inbox and all its messages are permanently deleted. Custom local-parts enter a 5-minute cooldown before re-claim.' },
              ].map((step, i) => (
                <li key={i} className="relative pl-10">
                  <span className="absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-full bg-emerald-500/10 text-sm font-bold text-emerald-600 dark:text-emerald-400 ring-4 ring-background">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold">{step.t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.d}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      {/* Privacy & security */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Privacy & security model</CardTitle>
            <CardDescription>What we do (and don't do) with your data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <PrivacyRow icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="No sign-up, no email, no phone number required" />
              <PrivacyRow icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="Anonymous session cookie (HttpOnly, SameSite=Strict)" />
              <PrivacyRow icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="No third-party analytics or tracking pixels" />
              <PrivacyRow icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="Mail HTML rendered in sandboxed iframe" />
              <PrivacyRow icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="External resources blocked by default" />
              <PrivacyRow icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="Inboxes auto-deleted on expiry" />
              <PrivacyRow icon={<Ban className="h-4 w-4 text-amber-500" />} text="No real .edu / .ac.in impersonation" warn />
              <PrivacyRow icon={<ShieldAlert className="h-4 w-4 text-amber-500" />} text="Anyone with the address can read your mail" warn />
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-300 flex gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong>Important:</strong> StudentTemp is for one-time verifications, throwaway sign-ups, and testing. Never use it for banking, primary email, or anything tied to your real identity.</span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="mb-4 text-lg font-bold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-emerald-500" /> FAQ
        </h2>
        <Card>
          <CardContent className="pt-2">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="f1">
                <AccordionTrigger>Is StudentTemp really free?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  Yes — 100% free, no ads, no tracking. The platform is built to run on free-tier infrastructure (Cloudflare, Postgres free tier, etc.).
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="f2">
                <AccordionTrigger>Why can't I get a real .edu or .ac.in email here?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  Forging real institutional domains would be fraudulent and could be used for impersonation. StudentTemp only uses operator-owned domains (studentbox.in, campusmail.in, etc.) clearly labeled as temporary — never real school/college/university addresses.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="f3">
                <AccordionTrigger>How long do inboxes last?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  You pick from 5 minutes up to 24 hours at creation time. The countdown is visible in real time. You can extend by 10 minutes at any point before expiry.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="f4">
                <AccordionTrigger>Can I have more than one inbox?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  Yes — up to 5 active inboxes per session. Manage them all on the "My Addresses" tab. Switch between them instantly.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="f5">
                <AccordionTrigger>What is "burn-on-read"?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  A single-use mode: the inbox auto-expires 60 seconds after the first message is opened. Perfect for grabbing a one-time OTP and nuking the inbox immediately.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="f6">
                <AccordionTrigger>What if I report a message?</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  The message is flagged for admin review and categorized (spam, phishing, abuse, other). The sender is never notified. Reports help tune future filtering.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 p-8 text-center">
        <h2 className="text-xl font-bold">Ready to protect your real inbox?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Generate a disposable address in seconds. No sign-up, no commitment.
        </p>
        <Button className="mt-5 gap-2" onClick={() => setActiveSection('inbox')}>
          Get started <ArrowRight className="h-4 w-4" />
        </Button>
      </section>

      {/* Credits & Footer */}
      <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 p-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-4">
          <Sparkles className="h-3.5 w-3.5" /> Credits
        </div>
        <h2 className="text-xl font-bold">Made with <Heart className="inline h-4 w-4 text-red-500 fill-red-500" /> by Roshan</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Designed, developed, and maintained by <span className="font-semibold text-foreground">Roshan</span>.
          Built using Next.js, Prisma, Socket.IO & shadcn/ui.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Badge variant="outline" className="gap-1.5 bg-card">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Developer: Roshan
          </Badge>
          <Badge variant="outline" className="gap-1.5 bg-card">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" /> Privacy-first
          </Badge>
          <Badge variant="outline" className="gap-1.5 bg-card">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Open Source
          </Badge>
        </div>
      </section>

      {/* Disclaimer footer */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-center text-xs text-muted-foreground">
        <p className="flex items-center justify-center gap-1.5">
          Built with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> using Next.js, Prisma, Socket.IO & shadcn/ui
        </p>
        <p className="mt-1">This is a private temporary address service, not an official institution email.</p>
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-border/60 bg-card p-5"
    >
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500">
        {icon}
      </div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </motion.div>
  )
}

function PrivacyRow({ icon, text, warn }: { icon: React.ReactNode; text: string; warn?: boolean }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-lg p-2.5 ${warn ? 'bg-amber-500/5' : 'bg-emerald-500/5'}`}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <span className="text-sm">{text}</span>
    </div>
  )
}

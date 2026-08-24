'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useMotionValueEvent,
  animate,
  useReducedMotion,
  type MotionValue,
} from 'framer-motion'
import {
  Mail,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  X,
  ChevronLeft,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

type Slide = {
  icon: typeof Mail
  heading: string
  body: string
  /** gradient classes for the icon badge */
  badge: string
  /** halo oklch color (used for the radial blur + glow) */
  halo: string
  /** tiny accent dots scattered around the icon */
  spark: string
}

const SLIDES: Slide[] = [
  {
    icon: Mail,
    heading: 'Your inbox, disposable by design',
    body:
      'Generate a fresh email address in seconds. No sign-up, no tracking, no commitment.',
    badge: 'from-emerald-400 to-teal-500',
    halo: 'oklch(0.7 0.15 165)',
    spark: 'bg-emerald-300',
  },
  {
    icon: ShieldCheck,
    heading: 'Real email, sandboxed and safe',
    body:
      'Incoming mail is rendered in a sandboxed iframe with external resources blocked. SPF, DKIM, and DMARC results shown per message.',
    badge: 'from-teal-400 to-cyan-500',
    halo: 'oklch(0.72 0.13 200)',
    spark: 'bg-cyan-300',
  },
  {
    icon: Sparkles,
    heading: 'Customize it, make it yours',
    body:
      'Pick a memorable local-part, choose from 5 student-themed domains, and manage up to 5 inboxes at once.',
    badge: 'from-emerald-500 to-cyan-500',
    halo: 'oklch(0.72 0.14 180)',
    spark: 'bg-teal-300',
  },
]

const EASE = [0.16, 1, 0.3, 1] as const

export function OnboardingOverlay() {
  const hasSeen = useAppStore((s) => s.hasSeenOnboarding)
  const setHasSeen = useAppStore((s) => s.setHasSeenOnboarding)

  const [mounted, setMounted] = useState(false)
  const [index, setIndex] = useState(0)
  const [width, setWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  // Track the current "rest" position of the carousel so we can compute the
  // drag-deviation for parallax — even mid-animation when `index` has changed.
  const restXRef = useRef(0)

  const x = useMotionValue(0)
  const parallaxX = useMotionValue(0)

  useEffect(() => setMounted(true), [])

  // Synchronous measure so the very first paint already knows the slide width.
  useLayoutEffect(() => {
    if (!containerRef.current) return
    const w = containerRef.current.clientWidth
    if (w > 0) setWidth(w)
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w > 0) setWidth(w)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Snap the track to the active slide whenever `index` (or width) changes.
  useEffect(() => {
    if (!width) return
    const target = -index * width
    restXRef.current = target
    if (reduce) {
      x.set(target)
      parallaxX.set(0)
      return
    }
    const c1 = animate(x, target, {
      type: 'spring',
      stiffness: 320,
      damping: 34,
      mass: 0.8,
    })
    const c2 = animate(parallaxX, 0, {
      type: 'spring',
      stiffness: 320,
      damping: 34,
      mass: 0.8,
    })
    return () => {
      c1.stop()
      c2.stop()
    }
  }, [index, width, reduce, x, parallaxX])

  // Parallax: illustration lags by 0.3x of the drag-deviation from the rest
  // position. Foreground text moves 1x (with the slide), illustration 0.7x.
  useMotionValueEvent(x, 'change', (latest) => {
    parallaxX.set(-0.3 * (latest - restXRef.current))
  })

  const paginate = useCallback((dir: 1 | -1) => {
    setIndex((i) => Math.max(0, Math.min(SLIDES.length - 1, i + dir)))
  }, [])

  const dismiss = useCallback(() => setHasSeen(true), [setHasSeen])

  // Keyboard navigation: ← → to move, Esc to skip
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        paginate(1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        paginate(-1)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        dismiss()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paginate, dismiss])

  // Lock body scroll while the overlay is open
  useEffect(() => {
    if (!mounted || hasSeen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mounted, hasSeen])

  if (!mounted || hasSeen) return null

  const isFinal = index === SLIDES.length - 1

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 grid place-items-center p-4 sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0 : 0.3 }}
      >
        {/* backdrop */}
        <div
          className="absolute inset-0 bg-black/55 backdrop-blur-md dark:bg-black/70"
          onClick={dismiss}
          aria-hidden
        />

        {/* card */}
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to StudentTemp"
          className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-border/60 bg-card shadow-2xl shadow-emerald-950/30 ring-1 ring-white/[0.03] dark:ring-white/[0.04]"
          initial={{ y: 18, scale: 0.97, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 8, scale: 0.98, opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}
        >
          {/* subtle top emerald wash for premium feel */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-emerald-500/[0.07] via-emerald-500/[0.02] to-transparent"
          />

          {/* Skip button (top-right) */}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Skip onboarding"
            className="absolute right-4 top-4 z-30 grid h-9 w-9 place-items-center rounded-full border border-border/60 bg-background/70 text-muted-foreground backdrop-blur-md transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>

          {/* progress rail */}
          <div
            className="absolute left-0 right-0 top-0 z-20 h-0.5 bg-border/50"
            aria-hidden
          >
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
              animate={{ width: `${((index + 1) / SLIDES.length) * 100}%` }}
              transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}
            />
          </div>

          {/* slide carousel */}
          <div
            ref={containerRef}
            className="relative overflow-hidden"
            style={{ touchAction: 'pan-y' }}
          >
            <motion.div
              className="flex"
              style={{
                x,
                width: width ? width * SLIDES.length : undefined,
              }}
              drag={reduce ? false : 'x'}
              dragConstraints={{
                left: width ? -(width * (SLIDES.length - 1)) : 0,
                right: 0,
              }}
              dragElastic={0.1}
              dragMomentum={false}
              onDragEnd={(_, info) => {
                const threshold = width * 0.18
                const vThreshold = 500
                if (info.offset.x < -threshold || info.velocity.x < -vThreshold) {
                  paginate(1)
                } else if (
                  info.offset.x > threshold ||
                  info.velocity.x > vThreshold
                ) {
                  paginate(-1)
                }
              }}
            >
              {SLIDES.map((slide, i) => (
                <SlideView
                  key={i}
                  slide={slide}
                  slideWidth={width}
                  parallaxX={parallaxX}
                  reduce={!!reduce}
                  active={i === index}
                />
              ))}
            </motion.div>
          </div>

          {/* footer: dots + actions */}
          <div className="relative z-10 flex flex-col items-center gap-4 border-t border-border/40 bg-card px-6 py-5">
            <div
              className="flex items-center gap-2"
              role="tablist"
              aria-label="Onboarding slides"
            >
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className="grid h-3 place-items-center px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
                  tabIndex={i === index ? 0 : -1}
                >
                  <motion.span
                    className="block rounded-full"
                    animate={{
                      width: i === index ? 28 : 8,
                      height: 8,
                      opacity: i === index ? 1 : 0.45,
                      backgroundColor:
                        i === index
                          ? 'oklch(0.62 0.15 165)'
                          : 'oklch(0.5 0.02 170 / 0.45)',
                    }}
                    transition={{
                      duration: reduce ? 0 : 0.4,
                      ease: EASE,
                    }}
                  />
                </button>
              ))}
            </div>

            <div className="flex w-full items-center gap-2">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => paginate(-1)}
                  aria-label="Previous slide"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border/60 bg-background text-foreground transition-colors hover:bg-accent"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}

              {isFinal ? (
                <motion.button
                  type="button"
                  onClick={dismiss}
                  aria-label="Create my inbox"
                  className="group relative flex h-11 flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-transform hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  animate={
                    reduce
                      ? {}
                      : {
                          boxShadow: [
                            '0 8px 24px -6px oklch(0.62 0.15 165 / 0.40), 0 0 0 0 oklch(0.62 0.15 165 / 0)',
                            '0 8px 30px -4px oklch(0.62 0.15 165 / 0.55), 0 0 0 6px oklch(0.62 0.15 165 / 0.10)',
                            '0 8px 24px -6px oklch(0.62 0.15 165 / 0.40), 0 0 0 0 oklch(0.62 0.15 165 / 0)',
                          ],
                        }
                  }
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Create my inbox
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </motion.button>
              ) : (
                <button
                  type="button"
                  onClick={() => paginate(1)}
                  aria-label="Next slide"
                  className="group flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Next
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={dismiss}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {isFinal ? 'Maybe later' : 'Skip tour'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function SlideView({
  slide,
  slideWidth,
  parallaxX,
  reduce,
  active,
}: {
  slide: Slide
  slideWidth: number
  parallaxX: MotionValue<number>
  reduce: boolean
  active: boolean
}) {
  const Icon = slide.icon
  return (
    <div
      className="shrink-0 px-6 pt-10 pb-3"
      style={{ width: slideWidth || '100%' }}
      aria-hidden={!active}
    >
      <div className="flex flex-col items-center text-center">
        {/* Illustration area */}
        <div className="relative mb-6 grid h-40 w-full place-items-center">
          {/* halo (background blob, breathes very slowly) */}
          <motion.div
            className="absolute inset-0 rounded-full opacity-60 blur-3xl"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${slide.halo} 0%, transparent 65%)`,
            }}
            animate={
              reduce ? {} : { scale: [1, 1.06, 1], opacity: [0.5, 0.7, 0.5] }
            }
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* icon badge (parallax-applied) */}
          <motion.div
            style={{ x: parallaxX }}
            className="relative"
            animate={reduce ? {} : { y: [0, -6, 0] }}
            transition={{
              duration: 3.6,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.1,
            }}
          >
            <div
              className={cn(
                'grid h-20 w-20 place-items-center rounded-[1.4rem] bg-gradient-to-br shadow-xl shadow-emerald-500/25 ring-1 ring-white/30',
                slide.badge,
              )}
            >
              <Icon className="h-9 w-9 text-white" strokeWidth={1.6} />
            </div>

            {/* sparkle accents */}
            {!reduce && (
              <>
                <motion.span
                  className={cn(
                    'absolute -right-3 -top-1 h-2 w-2 rounded-full',
                    slide.spark,
                  )}
                  animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.2, 0.7] }}
                  transition={{
                    duration: 2.4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
                <motion.span
                  className={cn(
                    'absolute -bottom-1 -left-4 h-1.5 w-1.5 rounded-full',
                    slide.spark,
                  )}
                  animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.7, 1.1, 0.7] }}
                  transition={{
                    duration: 2.8,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 0.6,
                  }}
                />
                <motion.span
                  className="absolute -right-6 bottom-2 h-1 w-1 rounded-full bg-white/80"
                  animate={{ opacity: [0.1, 0.8, 0.1], scale: [0.6, 1, 0.6] }}
                  transition={{
                    duration: 3.2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 1.1,
                  }}
                />
              </>
            )}
          </motion.div>
        </div>

        {/* Text block — dim slightly when not active */}
        <motion.div
          className="flex flex-col items-center"
          animate={{
            opacity: active ? 1 : 0.35,
            y: active ? 0 : 6,
          }}
          transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
        >
          <h2 className="text-balance text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {slide.heading}
          </h2>
          <p className="mt-3 max-w-[19rem] text-pretty text-sm leading-relaxed text-muted-foreground">
            {slide.body}
          </p>
        </motion.div>
      </div>
    </div>
  )
}

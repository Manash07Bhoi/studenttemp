'use client'

import { useRef, useState, useCallback, useEffect, type ReactNode } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { RefreshCw, Check } from 'lucide-react'

/**
 * Pull-to-refresh wrapper (MOTION-SYSTEM.md §3.4).
 * - Standard elastic pull: content translates down following finger (1:1 up to threshold, then resistance)
 * - Circular progress indicator fills as user pulls past trigger threshold
 * - Brand icon rotates gently inside the indicator
 * - On release past threshold: indicator spins during fetch, then morphs into a checkmark briefly
 * - Haptic: light tick at threshold-crossed + on refresh-complete (mobile web Vibration API)
 * - Reduced-motion: disabled (instant refresh)
 */
const TRIGGER_THRESHOLD = 70
const MAX_PULL = 120

export function PullToRefresh({
  onRefresh,
  children,
  className,
}: {
  onRefresh: () => Promise<void> | void
  children: ReactNode
  className?: string
}) {
  const startY = useRef<number | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [showCheck, setShowCheck] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotionSafe()

  const progress = Math.min(pullDistance / TRIGGER_THRESHOLD, 1)
  const indicatorRotation = useTransform(
    useMotionValue(0),
    [0, 1],
    [0, 360]
  )

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return
    // Only start pull if the scroll area is at the top
    const el = containerRef.current
    if (!el) return
    const scrollTop = el.scrollTop || window.scrollY
    if (scrollTop > 0) return
    startY.current = e.touches[0].clientY
  }, [refreshing])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null || refreshing) return
    const delta = e.touches[0].clientY - startY.current
    if (delta <= 0) {
      setPullDistance(0)
      return
    }
    // Apply resistance beyond threshold (rubber-banding)
    const resisted = delta <= TRIGGER_THRESHOLD ? delta : TRIGGER_THRESHOLD + (delta - TRIGGER_THRESHOLD) * 0.4
    setPullDistance(Math.min(resisted, MAX_PULL))
  }, [refreshing])

  const handleTouchEnd = useCallback(async () => {
    if (startY.current === null) return
    startY.current = null

    if (pullDistance >= TRIGGER_THRESHOLD && !refreshing) {
      // Haptic tick at threshold
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(15)
      }
      setRefreshing(true)
      setPullDistance(TRIGGER_THRESHOLD * 0.6) // hold at threshold while refreshing
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setShowCheck(true)
        // Haptic on complete
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(10)
        }
        setTimeout(() => {
          setShowCheck(false)
          setPullDistance(0)
        }, 800)
      }
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, refreshing, onRefresh])

  if (reduceMotion) {
    // Reduced motion: just render children, no pull gesture
    return <div className={className} ref={containerRef}>{children}</div>
  }

  const indicatorSize = 36
  const ringRadius = (indicatorSize - 6) / 2
  const circumference = 2 * Math.PI * ringRadius

  return (
    <div
      ref={containerRef}
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Pull indicator */}
      <motion.div
        animate={{
          height: pullDistance > 0 || refreshing || showCheck ? Math.max(pullDistance, 28) : 0,
          opacity: pullDistance > 0 || refreshing || showCheck ? 1 : 0,
        }}
        transition={{ duration: refreshing ? 0 : 0.2 }}
        className="flex items-center justify-center overflow-hidden"
        style={{ height: pullDistance > 0 ? pullDistance : 0 }}
      >
        <div
          className="relative grid place-items-center"
          style={{ width: indicatorSize, height: indicatorSize }}
        >
          {showCheck ? (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <Check className="h-5 w-5 text-emerald-500" strokeWidth={3} />
            </motion.div>
          ) : (
            <>
              {/* Progress ring (SVG circle with strokeDashoffset) */}
              <svg width={indicatorSize} height={indicatorSize} className="absolute inset-0 -rotate-90">
                <circle
                  cx={indicatorSize / 2}
                  cy={indicatorSize / 2}
                  r={ringRadius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  className="text-muted-foreground/20"
                />
                <motion.circle
                  cx={indicatorSize / 2}
                  cy={indicatorSize / 2}
                  r={ringRadius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  className="text-emerald-500"
                  strokeDasharray={circumference}
                  style={{
                    strokeDashoffset: circumference * (1 - (refreshing ? 0.75 : progress)),
                  }}
                />
              </svg>
              {/* Brand icon (envelope) rotating */}
              <motion.div
                animate={refreshing ? { rotate: 360 } : { rotate: progress * 90 }}
                transition={refreshing ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : { duration: 0.1 }}
              >
                <RefreshCw className="h-3.5 w-3.5 text-emerald-500" />
              </motion.div>
            </>
          )}
        </div>
      </motion.div>

      {/* Content */}
      <motion.div
        animate={{ y: 0 }}
        style={{ transform: pullDistance > 0 ? `translateY(${pullDistance * 0.5}px)` : undefined }}
      >
        {children}
      </motion.div>
    </div>
  )
}

function useReducedMotionSafe(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = () => setReduced(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

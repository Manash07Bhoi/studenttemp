'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * Animated countdown timer chip with odometer-style digit rolls and
 * color-state transitions (normal → warning → critical → expired).
 */
export function CountdownTimer({
  expiresAt,
  onExpire,
  className,
  variant = 'default',
}: {
  expiresAt: Date | string
  onExpire?: () => void
  className?: string
  variant?: 'default' | 'compact'
}) {
  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
  const [remaining, setRemaining] = useState(() => Math.max(0, expiry.getTime() - Date.now()))
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, expiry.getTime() - Date.now())
      setRemaining(r)
      if (r === 0 && !expired) {
        setExpired(true)
        onExpire?.()
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiry.getTime()])

  const totalSec = Math.floor(remaining / 1000)
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  const display = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`

  // color state
  const state = expired
    ? 'expired'
    : remaining <= 60_000
    ? 'critical'
    : remaining <= 180_000
    ? 'warning'
    : 'normal'

  const stateClasses = {
    normal: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    critical: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    expired: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20',
  }[state]

  const isPulsing = state === 'critical' && !expired

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-sm font-semibold tabular-nums ${stateClasses} ${isPulsing ? 'animate-pulse' : ''} ${className || ''}`}
      role="timer"
      aria-label={expired ? 'Inbox expired' : `Time remaining: ${mins} minutes ${secs} seconds`}
    >
      {expired ? (
        <span className="flex items-center gap-1.5">
          <motion.span
            animate={{ x: [0, -4, 4, -4, 0] }}
            transition={{ duration: 0.3 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>
            </svg>
          </motion.span>
          Expired
        </span>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="13" r="8"/>
            <path d="M12 9v4l2 2M5 3 2 6M19 3l3 3"/>
          </svg>
          <span className="flex overflow-hidden h-[1.1em]">
            {display.split('').map((d, i) => (
              <motion.span
                key={`${i}-${d}`}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="inline-block"
              >
                {d}
              </motion.span>
            ))}
          </span>
          {variant === 'default' && <span className="text-[0.65rem] opacity-70 ml-0.5">left</span>}
        </>
      )}
    </div>
  )
}

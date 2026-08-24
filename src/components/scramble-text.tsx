'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * Character-scramble reveal animation for an email address.
 * Cycles random characters for ~500ms before settling left-to-right.
 */
const SCRAMBLE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function ScrambleText({
  text,
  className,
  duration = 500,
  charDelay = 25,
}: {
  text: string
  className?: string
  duration?: number
  charDelay?: number
}) {
  const [display, setDisplay] = useState(text)

  useEffect(() => {
    if (!text) {
      setDisplay('')
      return
    }
    let frame: number
    const startTime = performance.now()
    const chars = text.split('')

    const tick = (now: number) => {
      const elapsed = now - startTime
      let out = ''
      for (let i = 0; i < chars.length; i++) {
        const settleTime = i * charDelay
        if (elapsed >= duration + settleTime) {
          out += chars[i]
        } else if (elapsed >= settleTime) {
          // scramble phase for this char
          out += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
        } else {
          // not yet started scrambling (still hidden)
          out += ' '
        }
      }
      setDisplay(out)
      if (elapsed < duration + chars.length * charDelay) {
        frame = requestAnimationFrame(tick)
      } else {
        setDisplay(text)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [text, duration, charDelay])

  return (
    <span className={className} aria-label={text}>
      {display.split('').map((c, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: c === ' ' ? 0 : 1 }}
          transition={{ duration: 0.1 }}
          className="inline-block"
          style={{ width: c === ' ' ? '0.4em' : undefined }}
        >
          {c === ' ' ? '\u00A0' : c}
        </motion.span>
      ))}
    </span>
  )
}

'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

/**
 * Long-press detection hook (MOTION-SYSTEM.md §17).
 * - Fires `onLongPress` after `delay` ms of continuous press without significant movement.
 * - Provides `isLongPressing` state for scale-down feedback (0.98 per spec).
 * - Cancels if the pointer moves more than `moveTolerance` px (treats as drag, not press).
 * - Works for both touch and mouse.
 * - Haptic tick (Vibration API) on long-press registration.
 */
export function useLongPress(opts: {
  onLongPress: () => void
  delay?: number
  moveTolerance?: number
}) {
  const { onLongPress, delay = 500, moveTolerance = 10 } = opts
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const [isLongPressing, setIsLongPressing] = useState(false)
  const longPressedRef = useRef(false)

  const start = useCallback((e: React.PointerEvent) => {
    startPos.current = { x: e.clientX, y: e.clientY }
    longPressedRef.current = false
    timerRef.current = setTimeout(() => {
      setIsLongPressing(true)
      longPressedRef.current = true
      // Haptic tick on registration
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(12)
      }
      onLongPress()
    }, delay)
  }, [delay, onLongPress])

  const move = useCallback((e: React.PointerEvent) => {
    if (!startPos.current || !timerRef.current) return
    const dx = Math.abs(e.clientX - startPos.current.x)
    const dy = Math.abs(e.clientY - startPos.current.y)
    if (dx > moveTolerance || dy > moveTolerance) {
      // Cancel — this is a drag, not a long-press
      clearTimeout(timerRef.current)
      timerRef.current = null
      setIsLongPressing(false)
    }
  }, [moveTolerance])

  const clear = useCallback((_e?: React.PointerEvent) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    // Don't reset isLongPressing immediately — let the scale animation complete
    setTimeout(() => setIsLongPressing(false), 100)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return {
    bind: {
      onPointerDown: start,
      onPointerMove: move,
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerCancel: clear,
    },
    isLongPressing,
    didLongPress: longPressedRef,
  }
}

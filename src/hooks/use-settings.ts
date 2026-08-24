'use client'

import { useCallback, useRef } from 'react'

const LS_KEY = 'studenttemp_settings'

interface LocalSettings {
  soundEnabled: boolean
  autoDeleteOnRead: boolean
  defaultLifetime: number
  defaultDomain: string
  burnOnRead: boolean
  reduceMotion: boolean
  compactMessageList: boolean
  appLockEnabled: boolean
}

export const DEFAULT_SETTINGS: LocalSettings = {
  soundEnabled: false,
  autoDeleteOnRead: false,
  defaultLifetime: 10,
  defaultDomain: 'studentbox.in',
  burnOnRead: false,
  reduceMotion: false,
  compactMessageList: false,
  appLockEnabled: false,
}

export function loadSettings(): LocalSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: LocalSettings) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify(s))
}

/**
 * Real WebAudio-based sound effects.
 * Synthesizes short chimes (no audio files needed).
 * Respects the user's soundEnabled setting (opt-in only).
 */
export function useSound() {
  const ctxRef = useRef<AudioContext | null>(null)

  const getCtx = useCallback(() => {
    if (typeof window === 'undefined') return null
    if (!ctxRef.current) {
      try {
        ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      } catch { return null }
    }
    return ctxRef.current
  }, [])

  const playTone = useCallback((freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.1) => {
    const settings = loadSettings()
    if (!settings.soundEnabled) return
    const ctx = getCtx()
    if (!ctx) return
    // resume if suspended (autoplay policy)
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.value = volume
    osc.connect(gain)
    gain.connect(ctx.destination)
    const now = ctx.currentTime
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.start(now)
    osc.stop(now + duration)
  }, [getCtx])

  const playNewMessage = useCallback(() => {
    // Soft "pop" — ascending two-note chime (iMessage-style)
    playTone(660, 0.08, 'sine', 0.08)
    setTimeout(() => playTone(880, 0.12, 'sine', 0.08), 60)
  }, [playTone])

  const playCopy = useCallback(() => {
    // Very subtle click
    playTone(1200, 0.04, 'sine', 0.05)
  }, [playTone])

  const playError = useCallback(() => {
    // Low, single soft tone
    playTone(220, 0.18, 'sine', 0.1)
  }, [playTone])

  const playUnlock = useCallback(() => {
    // Gentle ascending two-note chime
    playTone(523, 0.1, 'sine', 0.08)
    setTimeout(() => playTone(784, 0.15, 'sine', 0.08), 100)
  }, [playTone])

  return { playNewMessage, playCopy, playError, playUnlock }
}

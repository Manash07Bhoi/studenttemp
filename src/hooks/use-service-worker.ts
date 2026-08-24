'use client'

import { useEffect } from 'react'

/**
 * Registers the StudentTemp service worker.
 * - Enables PWA installability
 * - Enables Web Push (PushManager requires an active service worker)
 * - Provides a minimal offline shell
 */
export function useServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production' && !window.location.hostname.includes('localhost')) return

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // Check for updates every 5 minutes
          setInterval(() => reg.update().catch(() => {}), 5 * 60 * 1000)
        })
        .catch((err) => {
          // Silently fail — SW is a progressive enhancement
          console.warn('[sw] registration failed:', err)
        })
    }

    // Register after window load to not compete with initial render
    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])
}

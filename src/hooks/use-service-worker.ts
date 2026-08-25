'use client'

import { useEffect } from 'react'

/**
 * Registers the StudentTemp service worker.
 * - Enables PWA installability
 * - Enables Web Push (PushManager requires an active service worker)
 * - Provides a minimal offline shell
 * - Auto-reloads when the SW updates (prevents stale content)
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
          // Listen for SW updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                  // New SW activated — reload to pick up changes
                  window.location.reload()
                }
              })
            }
          })
          // Check for updates every 5 minutes
          setInterval(() => reg.update().catch(() => {}), 5 * 60 * 1000)
        })
        .catch((err) => {
          // Silently fail — SW is a progressive enhancement
          console.warn('[sw] registration failed:', err)
        })
    }

    // Listen for SW messages (manual reload trigger from SW)
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        window.location.reload()
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)

    // Register after window load to not compete with initial render
    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
    }

    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage)
      window.removeEventListener('load', register)
    }
  }, [])
}

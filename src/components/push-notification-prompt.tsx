'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, Sparkles } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'

/**
 * Web Push notification pre-prompt card (MOTION-SYSTEM.md §15).
 * Shows a custom in-app card BEFORE triggering the native browser permission dialog.
 * - Only appears if: user has an active inbox, hasn't dismissed, hasn't subscribed,
 *   and notifications are supported.
 * - Bell icon does a single gentle "ring" wiggle on appearance.
 * - After "Enable", the real browser permission dialog fires.
 * - Slides up from bottom, dismissable, stays until action/timeout.
 */
export function PushNotificationPrompt() {
  const [show, setShow] = useState(false)
  const activeInboxId = useAppStore((s) => s.activeInboxId)
  const inboxes = useAppStore((s) => s.inboxes)
  const pushPromptDismissed = useAppStore((s) => s.pushPromptDismissed)
  const setPushPromptDismissed = useAppStore((s) => s.setPushPromptDismissed)

  useEffect(() => {
    // Wait 12 seconds after the user has an active inbox before showing
    if (!activeInboxId || pushPromptDismissed) return
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'default') return
    if (!('serviceWorker' in navigator)) return

    const t = setTimeout(() => setShow(true), 12_000)
    return () => clearTimeout(t)
  }, [activeInboxId, pushPromptDismissed])

  const handleEnable = async () => {
    setShow(false)
    setPushPromptDismissed(true)
    // Defer to the next tick so the prompt closes before the browser dialog opens
    setTimeout(async () => {
      if (typeof Notification === 'undefined') return
      const perm = await Notification.requestPermission()
      if (perm === 'granted') {
        // Try to subscribe via PushManager
        try {
          const reg = await navigator.serviceWorker.ready
          const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
          if (vapidPublicKey) {
            const sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            })
            const subJson = sub.toJSON()
            const { api } = await import('@/lib/api-client')
            await api.subscribePush({
              endpoint: subJson.endpoint || '',
              keys: { p256dh: subJson.keys?.p256dh || '', auth: subJson.keys?.auth || '' },
            })
          }
        } catch {}
      }
    }, 350)
  }

  const handleDismiss = () => {
    setShow(false)
    setPushPromptDismissed(true)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md"
          role="dialog"
          aria-label="Enable notifications"
        >
          <div className="relative rounded-2xl border border-emerald-500/30 bg-card p-4 shadow-2xl shadow-emerald-500/10">
            <div className="flex items-start gap-3">
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: [0, -8, 8, -8, 0] }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white"
              >
                <Bell className="h-5 w-5" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  Get notified of new mail
                  <Sparkles className="h-3 w-3 text-emerald-500" />
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Receive a browser notification the moment a message lands in your inbox. No message content is sent — just a ping.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" onClick={handleEnable} className="gap-1.5">
                    <Bell className="h-3.5 w-3.5" /> Enable
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleDismiss}>
                    Maybe later
                  </Button>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i)
  return output
}

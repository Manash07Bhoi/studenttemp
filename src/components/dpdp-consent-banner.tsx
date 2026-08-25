'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'

const LS_KEY = 'studenttemp_dpdp_consented'

/**
 * DPDP (Digital Personal Data Protection Act, 2023) consent notice.
 * Shows on first visit, distinct from a cookie banner.
 * Per GAP H9: "DPDP-compliant consent/notice banner on first visit"
 */
export function DpdpConsentBanner() {
  const [show, setShow] = useState(false)
  const hasSeenOnboarding = useAppStore((s) => s.hasSeenOnboarding)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem(LS_KEY)) {
      // Wait until onboarding is dismissed before showing
      if (!hasSeenOnboarding) {
        // Poll until onboarding is done
        const interval = setInterval(() => {
          if (useAppStore.getState().hasSeenOnboarding) {
            clearInterval(interval)
            setTimeout(() => setShow(true), 1000)
          }
        }, 500)
        return () => clearInterval(interval)
      }
      // Onboarding already seen — show after short delay
      const t = setTimeout(() => setShow(true), 1500)
      return () => clearTimeout(t)
    }
  }, [hasSeenOnboarding])

  const handleAccept = () => {
    localStorage.setItem(LS_KEY, '1')
    setShow(false)
  }

  const handleDismiss = () => {
    // Even dismissal is treated as "seen" — we don't force consent
    localStorage.setItem(LS_KEY, 'dismissed')
    setShow(false)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-lg"
          role="dialog"
          aria-label="Privacy notice"
        >
          <div className="relative rounded-2xl border border-emerald-500/30 bg-card p-4 shadow-2xl">
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3 pr-6">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <Shield className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">Privacy Notice (DPDP Act, 2023)</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  StudentTemp collects minimal anonymous data (a session token) to operate your temporary inbox.
                  No personal data (name, email, phone) is collected. Inboxes and messages auto-delete on expiry.
                  You have the right to access, export, and erase your data anytime via Settings.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" onClick={handleAccept} className="gap-1.5">
                    <Check className="h-3.5 w-3.5" /> I understand
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleDismiss}>
                    Later
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

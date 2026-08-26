'use client'

import { useEffect, useState } from 'react'
import { SiteAccessGate } from '@/components/site-access-gate'
import { AppShell } from '@/components/app-shell'
import { RefreshCw } from 'lucide-react'

/**
 * SiteAccessGateWrapper — checks if the visitor has the site access cookie.
 * If not, shows the SiteAccessGate (password screen).
 * If yes, shows the AppShell (the actual app).
 *
 * This is a client component because it needs to fetch the access status
 * from the API and conditionally render based on the response.
 */
export function SiteAccessGateWrapper() {
  const [status, setStatus] = useState<'checking' | 'granted' | 'denied'>('checking')

  useEffect(() => {
    let mounted = true
    fetch('/api/site-access/verify')
      .then(res => res.json())
      .then(data => {
        if (!mounted) return
        if (data.hasAccess) {
          setStatus('granted')
        } else {
          setStatus('denied')
        }
      })
      .catch(() => {
        if (mounted) setStatus('denied')
      })
    return () => { mounted = false }
  }, [])

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === 'denied') {
    return <SiteAccessGate />
  }

  return <AppShell />
}

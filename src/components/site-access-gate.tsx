'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * SiteAccessGate — a password screen that blocks all access until the correct
 * password is entered. Used during the testing period to restrict access to
 * friends and family who know the password.
 *
 * On successful verification, the API sets an HttpOnly cookie and this
 * component reloads the page to show the actual app.
 */
export function SiteAccessGate() {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/site-access/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(true)
        toast.error('Incorrect password')
        setPassword('')
        return
      }
      toast.success('Access granted')
      // Reload to show the actual app
      window.location.reload()
    } catch {
      setError(true)
      toast.error('Failed to verify')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-emerald-950/20 p-4">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative w-full max-w-sm"
      >
        <div className="rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl p-8 space-y-6">
          {/* Logo + Title */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg">
              <Lock className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">StudentTemp</h1>
              <p className="text-sm text-muted-foreground mt-1">
                This site is in private testing.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Enter the access password to continue.
              </p>
            </div>
          </div>

          {/* Password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="access-password" className="text-xs font-medium">
                Access Password
              </Label>
              <div className="relative">
                <Input
                  id="access-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError(false)
                  }}
                  placeholder="Enter password"
                  autoFocus
                  className={`pr-10 ${error ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {error && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Incorrect password. Please try again.
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={!password || loading}
              className="w-full gap-2"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <ShieldCheck className="h-4 w-4" />
                </motion.div>
              ) : (
                <>
                  Unlock Access
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Don't have the password? Ask the site admin.
            </p>
          </div>
        </div>

        {/* Credit */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Developed by Roshan
        </p>
      </motion.div>
    </div>
  )
}

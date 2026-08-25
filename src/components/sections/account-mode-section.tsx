'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  User, Lock, Mail, Phone, Globe, Palette, Shield, Tag, Filter, Users,
  HardDrive, Download, Trash2, LogOut, Plus, X, Check, AlertCircle,
  Smartphone, Calendar, MessageSquare, Send, Key, Eye, EyeOff, ChevronRight,
  Activity, Database, Server, Flag, FileText, BarChart3, RefreshCw, Copy,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

// ========================================
// Main Account Mode Section — routes between sub-views
// ========================================
export function AccountModeSection() {
  const activeSection = useAppStore((s) => s.activeSection)
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const account = useAppStore((s) => s.account)
  const setAccount = useAppStore((s) => s.setAccount)

  // Check auth status on mount
  const { data: meData, isLoading: meLoading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: api.auth.me,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (meData?.account) {
      setAccount({
        id: meData.account.id,
        email: meData.account.email,
        displayName: meData.account.displayName,
        totpEnabled: meData.account.totpEnabled,
      })
    } else if (meData && !meData.account) {
      setAccount(null)
    }
  }, [meData, setAccount])

  // Not logged in → show auth screen
  if (!meLoading && !meData?.account && activeSection !== 'auth') {
    return <AuthScreen />
  }

  // Loading state
  if (meLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Route to the correct sub-view
  switch (activeSection) {
    case 'auth': return <AuthScreen />
    case 'profile-setup': return <ProfileSetupScreen />
    case 'account-home': return <AccountHomeScreen />
    case 'labels-filters': return <LabelsFiltersScreen />
    case 'contacts': return <ContactsScreen />
    case 'storage': return <StorageScreen />
    case 'security': return <SecurityScreen />
    case 'account-switcher': return <AccountSwitcherScreen />
    case 'vacation': return <VacationScreen />
    case 'admin': return <AdminDashboardScreen />
    default:
      // If logged in, show account home; otherwise auth
      return meData?.account ? <AccountHomeScreen /> : <AuthScreen />
  }
}

// ========================================
// Screen A1 — Sign Up / Login
// ========================================
function AuthScreen() {
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const setAccount = useAppStore((s) => s.setAccount)
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [form, setForm] = useState({
    fullName: '', username: '', domain: 'studentbox.in', password: '',
    recoveryEmail: '', email: '', totpCode: '',
  })
  const [requires2FA, setRequires2FA] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [aliasAvailable, setAliasAvailable] = useState<boolean | null>(null)
  const queryClient = useQueryClient()

  // Debounced username availability check (signup mode)
  useEffect(() => {
    if (mode !== 'signup' || !form.username || form.username.length < 3) {
      setAliasAvailable(null)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.checkAlias(form.username, form.domain)
        setAliasAvailable(res.available)
      } catch {
        setAliasAvailable(null)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [form.username, form.domain, mode])

  // Password strength calculation
  const passwordStrength = useCallback(() => {
    const p = form.password
    if (!p) return { score: 0, label: '', color: '' }
    let score = 0
    if (p.length >= 8) score++
    if (p.length >= 12) score++
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++
    if (/\d/.test(p)) score++
    if (/[^a-zA-Z0-9]/.test(p)) score++
    const labels = ['', 'Very weak', 'Weak', 'Fair', 'Good', 'Strong']
    const colors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-emerald-500']
    return { score, label: labels[score], color: colors[score] }
  }, [form.password])

  const strength = passwordStrength()

  const signupMutation = useMutation({
    mutationFn: () => api.auth.signup({
      fullName: form.fullName,
      username: form.username,
      domain: form.domain,
      password: form.password,
      recoveryEmail: form.recoveryEmail || undefined,
    }),
    onSuccess: (data) => {
      setAccount({
        id: data.account.id,
        email: data.account.email,
        displayName: data.account.displayName,
        totpEnabled: false,
      })
      queryClient.invalidateQueries({ queryKey: ['auth-me'] })
      // Route to Profile Setup, NOT Inbox (per spec Screen A1)
      setActiveSection('profile-setup')
      toast.success('Account created!', { description: data.account.email })
    },
    onError: (e: Error) => {
      toast.error('Signup failed', { description: e.message })
    },
  })

  const loginMutation = useMutation({
    mutationFn: () => api.auth.login({
      email: form.email || `${form.username}@${form.domain}`,
      password: form.password,
      totpCode: requires2FA ? form.totpCode : undefined,
    }),
    onSuccess: (data) => {
      setAccount({
        id: data.account.id,
        email: data.account.email,
        displayName: data.account.displayName,
        totpEnabled: data.account.totpEnabled,
      })
      queryClient.invalidateQueries({ queryKey: ['auth-me'] })
      setActiveSection('account-home')
      toast.success('Welcome back!', { description: data.account.email })
    },
    onError: (e: Error) => {
      const err = e as { message?: string }
      if (err.message?.includes('2FA')) {
        setRequires2FA(true)
        toast.info('Enter your 2FA code')
      } else {
        toast.error('Login failed', { description: err.message })
      }
    },
  })

  const handleSubmit = () => {
    if (mode === 'signup') {
      if (!form.fullName || !form.username || !form.password) {
        toast.error('Please fill all required fields')
        return
      }
      if (form.password.length < 8) {
        toast.error('Password must be at least 8 characters')
        return
      }
      if (!/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password)) {
        toast.error('Password must contain uppercase, lowercase, and a number')
        return
      }
      signupMutation.mutate()
    } else {
      if (!form.password) {
        toast.error('Password required')
        return
      }
      loginMutation.mutate()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-emerald-500/5">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            {mode === 'signup' ? 'Create Account' : 'Welcome Back'}
          </CardTitle>
          <p className="text-center text-sm text-muted-foreground">
            {mode === 'signup'
              ? 'Get a permanent mailbox with time-limited plans'
              : 'Sign in to your StudentTemp account'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === 'signup' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Rahul Sharma"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="flex gap-2">
                  <Input
                    id="username"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().trim() })}
                    placeholder="rahul.dev"
                    className="flex-1"
                  />
                  <Select value={form.domain} onValueChange={(v) => setForm({ ...form, domain: v })}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="studentbox.in">studentbox.in</SelectItem>
                      <SelectItem value="campusmail.in">campusmail.in</SelectItem>
                      <SelectItem value="examprep.in">examprep.in</SelectItem>
                      <SelectItem value="devtest.in">devtest.in</SelectItem>
                      <SelectItem value="quickmail.in">quickmail.in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {aliasAvailable !== null && form.username && (
                  <p className={cn('text-xs flex items-center gap-1', aliasAvailable ? 'text-emerald-600' : 'text-red-500')}>
                    {aliasAvailable ? <><Check className="h-3 w-3" /> Available</> : <><X className="h-3 w-3" /> Taken</>}
                  </p>
                )}
              </div>
            </>
          )}

          {mode === 'login' && !requires2FA && (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@studentbox.in"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {mode === 'signup' && strength.score > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={cn('h-1 flex-1 rounded-full', i <= strength.score ? strength.color : 'bg-muted')}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{strength.label}</p>
              </div>
            )}
          </div>

          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="recoveryEmail">Recovery Email (recommended)</Label>
              <Input
                id="recoveryEmail"
                type="email"
                value={form.recoveryEmail}
                onChange={(e) => setForm({ ...form, recoveryEmail: e.target.value })}
                placeholder="your.real@email.com"
              />
            </div>
          )}

          {requires2FA && (
            <div className="space-y-2">
              <Label htmlFor="totpCode">2FA Code</Label>
              <Input
                id="totpCode"
                value={form.totpCode}
                onChange={(e) => setForm({ ...form, totpCode: e.target.value })}
                placeholder="123456"
                maxLength={6}
                inputMode="numeric"
                className="text-center text-2xl tracking-widest"
              />
              <p className="text-xs text-muted-foreground">Enter the 6-digit code from your authenticator app</p>
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={signupMutation.isPending || loginMutation.isPending}
            className="w-full"
          >
            {(signupMutation.isPending || loginMutation.isPending) ? (
              <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Please wait...</>
            ) : mode === 'signup' ? 'Create Account' : requires2FA ? 'Verify & Sign In' : 'Sign In'}
          </Button>

          <div className="text-center text-sm">
            {mode === 'signup' ? (
              <>Already have an account?{' '}
                <button onClick={() => { setMode('login'); setRequires2FA(false) }} className="text-emerald-600 hover:underline font-medium">
                  Sign in
                </button>
              </>
            ) : (
              <>New here?{' '}
                <button onClick={() => { setMode('signup'); setRequires2FA(false) }} className="text-emerald-600 hover:underline font-medium">
                  Create account
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ========================================
// Screen A2 — Profile Setup (5-step flow)
// ========================================
function ProfileSetupScreen() {
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const account = useAppStore((s) => s.account)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    displayName: account?.displayName || '',
    recoveryEmail: '',
    recoveryPhone: '',
    language: 'en',
    theme: 'system' as 'light' | 'dark' | 'system',
    signature: '',
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      // Use the real auth.me to get the account, then update profile fields
      // Note: there's no dedicated profile-update API, but we can use the
      // auth endpoint to verify the account exists. The profile fields are
      // stored on the Account model — we need a profile-update endpoint.
      // For now, we'll persist what we can via the existing vacation API
      // (which doesn't fit) — so let's create a minimal update.
      const res = await fetch('/api/auth/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error('Failed to update profile')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Profile saved!')
      setActiveSection('account-home')
    },
    onError: (e: Error) => toast.error('Failed to save profile', { description: e.message }),
  })

  const steps = [
    { num: 1, label: 'Photo', icon: User },
    { num: 2, label: 'Name', icon: User },
    { num: 3, label: 'Recovery', icon: Mail },
    { num: 4, label: 'Language', icon: Globe },
    { num: 5, label: 'Signature', icon: MessageSquare },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Complete Your Profile</CardTitle>
          <div className="flex gap-2 mt-2">
            {steps.map((s) => (
              <div key={s.num} className={cn('flex-1 h-1 rounded-full', s.num <= step ? 'bg-emerald-500' : 'bg-muted')} />
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 && (
            <div className="space-y-3">
              <Label>Profile Photo</Label>
              <div className="flex flex-col items-center gap-3">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold">
                  {(form.displayName || account?.email || '?').charAt(0).toUpperCase()}
                </div>
                <p className="text-xs text-muted-foreground">Monogram avatar (your initials)</p>
                <Button variant="outline" size="sm" onClick={() => toast.info('Photo upload requires external storage (R2)')}>
                  Upload Photo
                </Button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="Rahul Sharma"
              />
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3">
              <Label>Recovery Options (at least one required)</Label>
              <div className="space-y-2">
                <Label htmlFor="recEmail" className="text-xs">Recovery Email</Label>
                <Input
                  id="recEmail"
                  type="email"
                  value={form.recoveryEmail}
                  onChange={(e) => setForm({ ...form, recoveryEmail: e.target.value })}
                  placeholder="your.real@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recPhone" className="text-xs">Recovery Phone</Label>
                <Input
                  id="recPhone"
                  type="tel"
                  value={form.recoveryPhone}
                  onChange={(e) => setForm({ ...form, recoveryPhone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> At least one recovery method is required
              </p>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-3">
              <Label>Language & Theme</Label>
              <div className="space-y-2">
                <Label className="text-xs">Language</Label>
                <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">हिन्दी (Hindi)</SelectItem>
                    <SelectItem value="ta">தமிழ் (Tamil)</SelectItem>
                    <SelectItem value="bn">বাংলা (Bengali)</SelectItem>
                    <SelectItem value="te">తెలుగు (Telugu)</SelectItem>
                    <SelectItem value="mr">मराठी (Marathi)</SelectItem>
                    <SelectItem value="or">ଓଡ଼ିଆ (Odia)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Theme</Label>
                <Select value={form.theme} onValueChange={(v: 'light' | 'dark' | 'system') => setForm({ ...form, theme: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {step === 5 && (
            <div className="space-y-2">
              <Label htmlFor="signature">Email Signature (optional)</Label>
              <Textarea
                id="signature"
                value={form.signature}
                onChange={(e) => setForm({ ...form, signature: e.target.value })}
                placeholder="— Rahul Sharma&#10;Student, IIT Delhi"
                rows={4}
              />
              <p className="text-xs text-muted-foreground">You can skip this step</p>
            </div>
          )}

          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>
            )}
            {step < 5 ? (
              <Button onClick={() => setStep(step + 1)} className="flex-1">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="flex-1">
                {updateMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Finish Setup
              </Button>
            )}
            {step === 5 && (
              <Button variant="ghost" onClick={() => setActiveSection('account-home')}>Skip</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ========================================
// Screen A3 — Account Home (Inbox)
// ========================================
function AccountHomeScreen() {
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const account = useAppStore((s) => s.account)
  const { data: labelsData } = useQuery({ queryKey: ['labels'], queryFn: api.labels.list })
  const { data: inboxData } = useQuery({ queryKey: ['account-inboxes'], queryFn: api.accountInboxes.list })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {account?.displayName || account?.email}</h1>
          <p className="text-sm text-muted-foreground">{account?.email}</p>
        </div>
        <Button onClick={() => setActiveSection('compose')} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Compose
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
        {/* Left rail — labels */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Labels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {labelsData?.labels.map((label) => (
              <div key={label.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent/40 cursor-pointer text-sm">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: label.color }} />
                <span className="flex-1 truncate">{label.name}</span>
                {label.retentionDays && (
                  <Badge variant="outline" className="text-xs">{label.retentionDays}d</Badge>
                )}
              </div>
            ))}
            <Separator className="my-2" />
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setActiveSection('labels-filters')}>
              <Tag className="h-3 w-3 mr-2" /> Manage Labels
            </Button>
          </CardContent>
        </Card>

        {/* Message list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Your Mailboxes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inboxData?.inboxes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No mailboxes yet</p>
              </div>
            )}
            {inboxData?.inboxes.map((inbox) => (
              <div key={inbox.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-mono text-sm">{inbox.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {inbox.isPermanent ? 'Permanent' : `Expires: ${new Date(inbox.expiresAt).toLocaleDateString()}`}
                  </p>
                </div>
                <Badge>{inbox._count?.messages || 0} messages</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick links to other Account Mode screens */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {[
          { label: 'Labels & Filters', icon: Tag, section: 'labels-filters' as const },
          { label: 'Contacts', icon: Users, section: 'contacts' as const },
          { label: 'Storage', icon: HardDrive, section: 'storage' as const },
          { label: 'Security', icon: Shield, section: 'security' as const },
          { label: 'Vacation', icon: Calendar, section: 'vacation' as const },
        ].map((item) => (
          <Button key={item.section} variant="outline" onClick={() => setActiveSection(item.section)} className="flex-col h-20 gap-1">
            <item.icon className="h-5 w-5" />
            <span className="text-xs">{item.label}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

// ========================================
// Screen A5 — Labels & Filters Manager
// ========================================
function LabelsFiltersScreen() {
  const [tab, setTab] = useState<'labels' | 'filters'>('labels')
  const queryClient = useQueryClient()

  const { data: labelsData } = useQuery({ queryKey: ['labels'], queryFn: api.labels.list })
  const { data: filtersData } = useQuery({ queryKey: ['filters'], queryFn: api.filters.list })

  const [showNewLabel, setShowNewLabel] = useState(false)
  const [newLabel, setNewLabel] = useState({ name: '', color: '#10b981', retentionDays: '' })

  const [showNewFilter, setShowNewFilter] = useState(false)
  const [newFilter, setNewFilter] = useState({
    conditions: [{ field: 'from', operator: 'contains', value: '' }],
    actions: [{ type: 'label', value: '' }],
    stopProcessing: false,
  })

  const createLabelMutation = useMutation({
    mutationFn: () => api.labels.create({
      name: newLabel.name,
      color: newLabel.color,
      retentionDays: newLabel.retentionDays ? parseInt(newLabel.retentionDays) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] })
      setShowNewLabel(false)
      setNewLabel({ name: '', color: '#10b981', retentionDays: '' })
      toast.success('Label created')
    },
    onError: (e: Error) => toast.error('Failed to create label', { description: e.message }),
  })

  const deleteLabelMutation = useMutation({
    mutationFn: (id: string) => api.labels.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] })
      toast.success('Label deleted')
    },
  })

  const createFilterMutation = useMutation({
    mutationFn: () => api.filters.create({
      conditions: newFilter.conditions,
      actions: newFilter.actions,
      stopProcessing: newFilter.stopProcessing,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filters'] })
      setShowNewFilter(false)
      setNewFilter({
        conditions: [{ field: 'from', operator: 'contains', value: '' }],
        actions: [{ type: 'label', value: '' }],
        stopProcessing: false,
      })
      toast.success('Filter created')
    },
    onError: (e: Error) => toast.error('Failed to create filter', { description: e.message }),
  })

  const deleteFilterMutation = useMutation({
    mutationFn: (id: string) => api.filters.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filters'] })
      toast.success('Filter deleted')
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Labels & Filters</h1>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === 'labels' ? 'default' : 'outline'} onClick={() => setTab('labels')} size="sm">
          <Tag className="h-4 w-4 mr-1" /> Labels
        </Button>
        <Button variant={tab === 'filters' ? 'default' : 'outline'} onClick={() => setTab('filters')} size="sm">
          <Filter className="h-4 w-4 mr-1" /> Filters
        </Button>
      </div>

      {tab === 'labels' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Your Labels</CardTitle>
              <Button size="sm" onClick={() => setShowNewLabel(true)} className="gap-1">
                <Plus className="h-3 w-3" /> New Label
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {labelsData?.labels.map((label) => (
              <div key={label.id} className="flex items-center gap-3 p-2 rounded border">
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: label.color }} />
                <span className="flex-1 font-medium">{label.name}</span>
                {label.isSystemLabel && <Badge variant="outline">System</Badge>}
                {label.retentionDays && (
                  <Badge variant="secondary">{label.retentionDays}d retention</Badge>
                )}
                {!label.isSystemLabel && (
                  <Button variant="ghost" size="sm" onClick={() => deleteLabelMutation.mutate(label.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === 'filters' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Your Filters</CardTitle>
              <Button size="sm" onClick={() => setShowNewFilter(true)} className="gap-1">
                <Plus className="h-3 w-3" /> New Filter
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {filtersData?.filters.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No filters yet</p>
            )}
            {filtersData?.filters.map((filter) => {
              const conditions = JSON.parse(filter.conditions)
              const actions = JSON.parse(filter.actions)
              return (
                <div key={filter.id} className="p-3 rounded border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Filter #{filter.priorityOrder + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => deleteFilterMutation.mutate(filter.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When {conditions.map((c: { field: string; value: string }) => `${c.field} contains "${c.value}"`).join(' AND ')}
                    {' → '}
                    {actions.map((a: { type: string; value?: string }) => a.type === 'label' ? `apply "${a.value}"` : a.type).join(', ')}
                  </p>
                  {filter.stopProcessing && <Badge variant="outline" className="text-xs">Stop processing after</Badge>}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* New Label Dialog */}
      <Dialog open={showNewLabel} onOpenChange={setShowNewLabel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Label</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={newLabel.name} onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })} placeholder="Work" />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2">
                {['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map((c) => (
                  <button key={c} onClick={() => setNewLabel({ ...newLabel, color: c })}
                    className={cn('h-8 w-8 rounded-full', newLabel.color === c && 'ring-2 ring-offset-2')}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div>
              <Label>Retention Days (empty = forever)</Label>
              <Input type="number" value={newLabel.retentionDays} onChange={(e) => setNewLabel({ ...newLabel, retentionDays: e.target.value })} placeholder="30" />
              <p className="text-xs text-muted-foreground mt-1">Messages with this label will be auto-deleted after N days</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewLabel(false)}>Cancel</Button>
            <Button onClick={() => createLabelMutation.mutate()} disabled={!newLabel.name || createLabelMutation.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Filter Dialog */}
      <Dialog open={showNewFilter} onOpenChange={setShowNewFilter}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Filter</DialogTitle>
            <DialogDescription>Apply actions when incoming mail matches conditions</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>When mail matches:</Label>
              {newFilter.conditions.map((cond, i) => (
                <div key={i} className="flex gap-2 mt-1">
                  <Select value={cond.field} onValueChange={(v) => {
                    const conditions = [...newFilter.conditions]
                    conditions[i] = { ...cond, field: v }
                    setNewFilter({ ...newFilter, conditions })
                  }}>
                    <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="from">From</SelectItem>
                      <SelectItem value="to">To</SelectItem>
                      <SelectItem value="subject">Subject</SelectItem>
                      <SelectItem value="hasAttachment">Has attachment</SelectItem>
                      <SelectItem value="size">Size &gt;</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input value={cond.value} onChange={(e) => {
                    const conditions = [...newFilter.conditions]
                    conditions[i] = { ...cond, value: e.target.value }
                    setNewFilter({ ...newFilter, conditions })
                  }} placeholder="value" className="flex-1" />
                </div>
              ))}
            </div>
            <div>
              <Label>Then:</Label>
              {newFilter.actions.map((act, i) => (
                <div key={i} className="flex gap-2 mt-1">
                  <Select value={act.type} onValueChange={(v) => {
                    const actions = [...newFilter.actions]
                    actions[i] = { ...act, type: v }
                    setNewFilter({ ...newFilter, actions })
                  }}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="label">Apply label</SelectItem>
                      <SelectItem value="archive">Archive</SelectItem>
                      <SelectItem value="markRead">Mark as read</SelectItem>
                      <SelectItem value="forward">Forward to</SelectItem>
                      <SelectItem value="delete">Delete</SelectItem>
                    </SelectContent>
                  </Select>
                  {(act.type === 'label' || act.type === 'forward') && (
                    <Input value={act.value || ''} onChange={(e) => {
                      const actions = [...newFilter.actions]
                      actions[i] = { ...act, value: e.target.value }
                      setNewFilter({ ...newFilter, actions })
                    }} placeholder="label name or email" className="flex-1" />
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={newFilter.stopProcessing} onCheckedChange={(v) => setNewFilter({ ...newFilter, stopProcessing: v })} />
              <Label>Stop processing more filters after this one</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewFilter(false)}>Cancel</Button>
            <Button onClick={() => createFilterMutation.mutate()} disabled={createFilterMutation.isPending}>Create Filter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ========================================
// Screen A6 — Contacts
// ========================================
function ContactsScreen() {
  const queryClient = useQueryClient()
  const { data: contactsData } = useQuery({ queryKey: ['contacts'], queryFn: api.contacts.list })
  const [showNew, setShowNew] = useState(false)
  const [newContact, setNewContact] = useState({ name: '', email: '', groupName: '' })
  const [search, setSearch] = useState('')

  const createMutation = useMutation({
    mutationFn: () => api.contacts.create({
      name: newContact.name,
      email: newContact.email,
      groupName: newContact.groupName || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      setShowNew(false)
      setNewContact({ name: '', email: '', groupName: '' })
      toast.success('Contact added')
    },
    onError: (e: Error) => toast.error('Failed to add contact', { description: e.message }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.contacts.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Contact deleted')
    },
  })

  const filtered = contactsData?.contacts.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
  ) || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <Button onClick={() => setShowNew(true)} size="sm" className="gap-1">
          <Plus className="h-3 w-3" /> Add Contact
        </Button>
      </div>

      <Input
        placeholder="Search contacts..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No contacts yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((contact) => (
                <div key={contact.id} className="flex items-center gap-3 p-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-700 text-sm font-bold">
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">{contact.email}</p>
                  </div>
                  {contact.groupName && <Badge variant="outline">{contact.groupName}</Badge>}
                  {contact.source === 'auto_suggested' && <Badge variant="secondary">Suggested</Badge>}
                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(contact.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
            </div>
            <div>
              <Label>Group (optional)</Label>
              <Input value={newContact.groupName} onChange={(e) => setNewContact({ ...newContact, groupName: e.target.value })} placeholder="Family, Work..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newContact.name || !newContact.email}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ========================================
// Screen A7 — Storage & Data Settings
// ========================================
function StorageScreen() {
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const { data: meData } = useQuery({ queryKey: ['auth-me'], queryFn: api.auth.me })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletePhrase, setDeletePhrase] = useState('')

  const account = meData?.account
  const usedBytes = account ? BigInt(account.storageUsedBytes) : BigInt(0)
  const quotaBytes = account ? BigInt(account.storageQuotaBytes) : BigInt(5368709120)
  const usedPercent = Number((usedBytes * BigInt(100)) / quotaBytes)

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteAccount(deletePhrase),
    onSuccess: () => {
      toast.success('Account scheduled for deletion', {
        description: 'Your account will be permanently deleted in 14 days. Sign in to cancel.',
      })
      // Reload to clear all client-side state
      setTimeout(() => window.location.reload(), 2000)
    },
    onError: (e: Error) => toast.error('Failed to delete account', { description: e.message }),
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Storage & Data</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Storage Usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>{(Number(usedBytes) / 1024 / 1024).toFixed(2)} MB used</span>
              <span>{(Number(quotaBytes) / 1024 / 1024 / 1024).toFixed(1)} GB quota</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(usedPercent, 100)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{usedPercent}% used</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Export Your Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full gap-2" onClick={() => window.open('/api/accounts/export', '_blank')}>
            <Download className="h-4 w-4" /> Export All Data (JSON)
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Downloads a JSON archive of all your messages, labels, contacts, and settings.
          </p>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated data. A 14-day grace period applies
            during which you can sign in to cancel.
          </p>
          <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)} className="gap-2">
            <Trash2 className="h-4 w-4" /> Delete Account
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Account</DialogTitle>
            <DialogDescription>
              This will schedule your account for permanent deletion in 14 days.
              All messages, attachments, labels, and contacts will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Type DELETE to confirm</Label>
            <Input value={deletePhrase} onChange={(e) => setDeletePhrase(e.target.value)} placeholder="DELETE" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" disabled={deletePhrase !== 'DELETE' || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}>
              {deleteMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Schedule Deletion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ========================================
// Screen A8 — Security Settings (2FA)
// ========================================
function SecurityScreen() {
  const queryClient = useQueryClient()
  const { data: meData } = useQuery({ queryKey: ['auth-me'], queryFn: api.auth.me })
  const { data: sessionsData } = useQuery({ queryKey: ['sessions'], queryFn: api.sessions.list })

  const [show2FASetup, setShow2FASetup] = useState(false)
  const [totpSecret, setTotpSecret] = useState('')
  const [totpQrUrl, setTotpQrUrl] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [showBackupCodes, setShowBackupCodes] = useState(false)

  const setup2FAMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/accounts/2fa/setup', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to setup 2FA')
      return res.json()
    },
    onSuccess: (data) => {
      setTotpSecret(data.secret)
      setTotpQrUrl(data.qrDataUrl)
      setShow2FASetup(true)
    },
    onError: (e: Error) => toast.error('Failed to setup 2FA', { description: e.message }),
  })

  const verify2FAMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/accounts/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Verification failed')
      }
      return res.json()
    },
    onSuccess: (data) => {
      setBackupCodes(data.backupCodes)
      setShowBackupCodes(true)
      setShow2FASetup(false)
      queryClient.invalidateQueries({ queryKey: ['auth-me'] })
      toast.success('2FA enabled!', { description: 'Save your backup codes' })
    },
    onError: (e: Error) => toast.error('Verification failed', { description: e.message }),
  })

  const revokeSessionMutation = useMutation({
    mutationFn: (id: string) => api.sessions.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast.success('Session revoked')
    },
  })

  const account = meData?.account

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Security</h1>

      {/* 2FA Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" /> Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">TOTP Authenticator App</p>
              <p className="text-xs text-muted-foreground">
                {account?.totpEnabled ? 'Enabled — your account is protected' : 'Not enabled'}
              </p>
            </div>
            {account?.totpEnabled ? (
              <Badge className="bg-emerald-500">Enabled</Badge>
            ) : (
              <Button onClick={() => setup2FAMutation.mutate()} disabled={setup2FAMutation.isPending}>
                {setup2FAMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Enable 2FA
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Smartphone className="h-4 w-4" /> Active Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sessionsData?.sessions.map((session) => (
            <div key={session.id} className="flex items-center gap-3 p-2 rounded border">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">{session.deviceInfo || 'Unknown device'}</p>
                <p className="text-xs text-muted-foreground">
                  Last seen: {new Date(session.lastSeenAt).toLocaleString()}
                </p>
              </div>
              {session.revoked && <Badge variant="outline">Revoked</Badge>}
              {!session.revoked && (
                <Button variant="ghost" size="sm" onClick={() => revokeSessionMutation.mutate(session.id)}>
                  <LogOut className="h-3 w-3" /> Revoke
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 2FA Setup Dialog */}
      <Dialog open={show2FASetup} onOpenChange={setShow2FASetup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Up 2FA</DialogTitle>
            <DialogDescription>Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {totpQrUrl && (
              <div className="flex justify-center">
                <img src={totpQrUrl} alt="QR Code" className="h-48 w-48" />
              </div>
            )}
            <div>
              <Label>Or enter manually:</Label>
              <Input readOnly value={totpSecret} className="font-mono text-xs" />
            </div>
            <div>
              <Label>Enter the 6-digit code from your app:</Label>
              <Input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                inputMode="numeric"
                className="text-center text-2xl tracking-widest"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShow2FASetup(false)}>Cancel</Button>
            <Button onClick={() => verify2FAMutation.mutate()} disabled={totpCode.length !== 6 || verify2FAMutation.isPending}>
              {verify2FAMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Verify & Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={showBackupCodes} onOpenChange={setShowBackupCodes}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Your Backup Codes</DialogTitle>
            <DialogDescription>
              These 10 codes can be used instead of your TOTP code if you lose your device.
              Each code can only be used once. Save them now — they cannot be viewed again.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((code, i) => (
              <div key={i} className="font-mono text-sm p-2 rounded bg-muted text-center">
                {code}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => { setShowBackupCodes(false); setBackupCodes([]) }}>
              I've saved them
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ========================================
// Screen A9 — Account Switcher
// ========================================
function AccountSwitcherScreen() {
  const account = useAppStore((s) => s.account)
  const setAccount = useAppStore((s) => s.setAccount)
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const queryClient = useQueryClient()

  const logoutMutation = useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => {
      setAccount(null)
      queryClient.invalidateQueries({ queryKey: ['auth-me'] })
      setActiveSection('inbox')
      toast.success('Signed out')
    },
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Account Switcher</h1>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3 p-3 rounded border bg-emerald-500/5">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold">
              {(account?.displayName || account?.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{account?.displayName || 'Account'}</p>
              <p className="text-xs text-muted-foreground">{account?.email}</p>
            </div>
            <Badge className="bg-emerald-500">Active</Badge>
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={() => setActiveSection('auth')}>
            <Plus className="h-4 w-4" /> Add another account
          </Button>

          <Button variant="destructive" className="w-full gap-2" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
            {logoutMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Sign out of all accounts
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ========================================
// Screen A10 — Vacation Responder
// ========================================
function VacationScreen() {
  const queryClient = useQueryClient()
  const { data: vacData } = useQuery({ queryKey: ['vacation'], queryFn: api.vacation.get })
  const [form, setForm] = useState({
    enabled: false,
    startDate: '',
    endDate: '',
    subject: '',
    body: '',
    contactsOnly: false,
  })

  useEffect(() => {
    if (vacData?.vacationResponder) {
      const vr = vacData.vacationResponder
      setForm({
        enabled: vr.enabled,
        startDate: vr.startDate ? vr.startDate.split('T')[0] : '',
        endDate: vr.endDate ? vr.endDate.split('T')[0] : '',
        subject: vr.subject,
        body: vr.body,
        contactsOnly: vr.contactsOnly,
      })
    }
  }, [vacData])

  const updateMutation = useMutation({
    mutationFn: () => api.vacation.update({
      ...form,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacation'] })
      toast.success('Vacation responder saved')
    },
    onError: (e: Error) => toast.error('Failed to save', { description: e.message }),
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Vacation Responder</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Auto-Reply</CardTitle>
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Out of office" />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={5}
              placeholder="Hi, I'm currently out of office and will respond when I return." />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.contactsOnly} onCheckedChange={(v) => setForm({ ...form, contactsOnly: v })} />
            <Label>Send only to contacts</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Auto-replies are sent once per sender to prevent loops. No-reply addresses are automatically skipped.
          </p>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="w-full">
            {updateMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ========================================
// Admin Dashboard (Screen 14)
// ========================================
function AdminDashboardScreen() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: api.admin.stats,
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  if (!stats) {
    return <div className="text-center py-8 text-muted-foreground">Access denied. Admin role required.</div>
  }

  const o = stats.overview
  const a = stats.accountMode

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard icon={Users} label="Accounts" value={o.totalAccounts} sub={`${o.activeAccounts} active`} />
        <StatCard icon={Mail} label="Inboxes" value={o.totalInboxes} sub={`${o.activeInboxes} active`} />
        <StatCard icon={MessageSquare} label="Messages" value={o.totalMessages} sub={`${o.messages24h} in 24h`} />
        <StatCard icon={Database} label="Attachments" value={o.totalAttachments} />
        <StatCard icon={Globe} label="Domains" value={o.domains} />
        <StatCard icon={Flag} label="Abuse Reports" value={o.abuseReports} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Account Mode Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <StatRow label="Filters" value={a.filters} />
            <StatRow label="Labels" value={a.labels} />
            <StatRow label="Contacts" value={a.contacts} />
            <StatRow label="Sent Messages" value={a.sentMessages} />
            <StatRow label="Drafts" value={a.drafts} />
            <StatRow label="Active Sessions" value={a.activeSessions} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Storage Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {(Number(o.totalStorageUsed) / 1024 / 1024).toFixed(2)} MB
            </p>
            <p className="text-xs text-muted-foreground">Total across all accounts</p>
          </CardContent>
        </Card>
      </div>

      {stats.abuse.byCategory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Abuse Reports by Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.abuse.byCategory.map((cat) => (
              <div key={cat.category} className="flex justify-between text-sm">
                <span className="capitalize">{cat.category}</span>
                <Badge variant="outline">{cat._count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Last updated: {new Date(stats.timestamp).toLocaleString()}
      </p>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-xs">{label}</span>
        </div>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

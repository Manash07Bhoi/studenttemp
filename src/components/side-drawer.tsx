'use client'

import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, AtSign, Plus, Settings, Shield, Moon, Globe, BookOpen, HelpCircle,
  FileText, Scale, Flag, Info, X, Mail, ChevronRight,
} from 'lucide-react'
import { useAppStore, type SectionId } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DrawerItem {
  id: SectionId | 'theme-dark' | 'external-link' | 'about-faq' | 'about-info' | 'legal-privacy' | 'legal-terms' | 'legal-abuse'
  label: string
  icon: typeof Home
  section?: SectionId
  href?: string
  action?: () => void
}

export function SideDrawer() {
  const drawerOpen = useAppStore((s) => s.drawerOpen)
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen)
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const activeSection = useAppStore((s) => s.activeSection)

  const items: DrawerItem[] = [
    { id: 'inbox', label: 'Home / Inbox', icon: Home, section: 'inbox' },
    { id: 'addresses', label: 'My Addresses', icon: AtSign, section: 'addresses' },
    { id: 'compose', label: 'Compose & Send Mail', icon: Plus, section: 'compose' },
    { id: 'settings', label: 'Settings', icon: Settings, section: 'settings' },
    { id: 'applock', label: 'App Lock', icon: Shield, section: 'applock' },
    { id: 'about', label: 'How It Works', icon: BookOpen, section: 'about' },
    { id: 'about-faq', label: 'FAQ', icon: HelpCircle, section: 'about' },
    { id: 'legal-privacy', label: 'Privacy Policy', icon: FileText, section: 'legal', },
    { id: 'legal-terms', label: 'Terms of Service', icon: Scale, section: 'legal' },
    { id: 'legal-abuse', label: 'Report Abuse', icon: Flag, section: 'legal' },
    { id: 'about-info', label: 'About', icon: Info, section: 'about' },
  ]

  const handleClick = (item: DrawerItem) => {
    if (item.section === 'legal') {
      // legal sub-items: pass doc param
      const docMap: Record<string, string> = {
        'legal-privacy': 'privacy',
        'legal-terms': 'terms',
        'legal-abuse': 'abuse',
      }
      setActiveSection('legal', { doc: docMap[item.id] || 'privacy' })
    } else if (item.section) {
      setActiveSection(item.section)
    }
    setDrawerOpen(false)
  }

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
          />
          <motion.aside
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className="fixed left-0 top-0 z-50 h-full w-72 max-w-[85vw] bg-card border-r border-border shadow-2xl md:hidden flex flex-col"
            role="dialog" aria-label="Navigation drawer"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 text-white">
                  <Mail className="h-4 w-4" />
                </span>
                <span className="font-bold">Student<span className="text-gradient-brand">Temp</span></span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDrawerOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2">
              {items.map((item) => {
                const active = activeSection === item.section
                return (
                  <button
                    key={item.id}
                    onClick={() => handleClick(item)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors text-left',
                      active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-30" />
                  </button>
                )
              })}
            </nav>
            <div className="border-t border-border p-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5"><Shield className="h-3 w-3" /> No tracking · No sign-up</p>
              <p className="mt-1">Not an official institution email.</p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

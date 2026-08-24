'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun, Monitor } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Theme toggle with a circular reveal wipe originating from the button position.
 * Falls back to instant swap when prefers-reduced-motion is set.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setMounted(true), [])

  const applyTheme = (next: string) => {
    if (typeof window === 'undefined' || !btnRef.current) {
      setTheme(next)
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setTheme(next)
      return
    }
    // circular reveal
    const rect = btnRef.current.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    // @ts-expect-error - ViewTransition API is not in TS lib yet
    if (!document.startViewTransition) {
      setTheme(next)
      return
    }
    // @ts-expect-error - ViewTransition API
    const transition = document.startViewTransition(() => setTheme(next))
    transition.ready.then(() => {
      const clipPath = [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`]
      document.documentElement.animate(
        { clipPath: next === 'dark' ? clipPath : [...clipPath].reverse() },
        { duration: 400, easing: 'ease-in-out', pseudoElement: next === 'dark' ? '::view-transition-new(root)' : '::view-transition-old(root)' }
      )
    })
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9" ref={btnRef} aria-label="Toggle theme">
        <Sun className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button ref={btnRef} variant="ghost" size="icon" className="h-9 w-9 relative" aria-label="Toggle theme">
          {resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        <DropdownMenuItem onClick={() => applyTheme('light')} className="gap-2 cursor-pointer">
          <Sun className="h-4 w-4" /> Light
          {theme === 'light' && <span className="ml-auto text-primary">●</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => applyTheme('dark')} className="gap-2 cursor-pointer">
          <Moon className="h-4 w-4" /> Dark
          {theme === 'dark' && <span className="ml-auto text-primary">●</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => applyTheme('system')} className="gap-2 cursor-pointer">
          <Monitor className="h-4 w-4" /> System
          {theme === 'system' && <span className="ml-auto text-primary">●</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

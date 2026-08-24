'use client'

/**
 * KeyboardShortcutsDialog — `?` help overlay that lists every keyboard
 * shortcut the app supports, grouped by category, in a clean table.
 *
 * Open state is held in the Zustand store so the keyboard-shortcuts hook and
 * the command palette's "Show keyboard shortcuts" action can both drive it.
 */
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { useAppStore } from '@/lib/store'
import { Keyboard } from 'lucide-react'

interface ShortcutRow {
  keys: string
  desc: string
}

interface ShortcutGroup {
  heading: string
  rows: ShortcutRow[]
}

const GROUPS: ShortcutGroup[] = [
  {
    heading: 'Navigation (press g, then …)',
    rows: [
      { keys: 'g  i', desc: 'Go to Inbox' },
      { keys: 'g  m', desc: 'Go to Messages' },
      { keys: 'g  a', desc: 'Go to Addresses' },
      { keys: 'g  c', desc: 'Go to Compose' },
      { keys: 'g  s', desc: 'Go to Settings' },
      { keys: 'g  ?', desc: 'Go to About' },
    ],
  },
  {
    heading: 'Actions',
    rows: [
      { keys: 'c', desc: 'Copy active inbox email' },
      { keys: 'n', desc: 'Generate a new random inbox (Inbox section)' },
      { keys: 'r', desc: 'Refresh messages (Messages section)' },
      { keys: '/', desc: 'Focus the search box (Messages section)' },
      { keys: 'j', desc: 'Next message (Messages section)' },
      { keys: 'k', desc: 'Previous message (Messages section)' },
      { keys: 'Enter', desc: 'Open the keyboard-selected message' },
    ],
  },
  {
    heading: 'Global',
    rows: [
      { keys: '⌘ / Ctrl + K', desc: 'Open the command palette' },
      { keys: '?', desc: 'Show this shortcuts help' },
      { keys: 'Esc', desc: 'Close any open dialog / palette / message reader' },
    ],
  },
]

export function KeyboardShortcutsDialog() {
  const open = useAppStore((s) => s.shortcutsDialogOpen)
  const setOpen = useAppStore((s) => s.setShortcutsDialogOpen)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/60 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-sm">
              <Keyboard className="h-4 w-4" />
            </span>
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="text-xs">
            Power-user keys for fast navigation. Shortcuts are suppressed while
            typing in inputs (except <kbd className="font-mono">⌘K</kbd> and{' '}
            <kbd className="font-mono">Esc</kbd>).
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto scrollbar-thin px-2 py-2">
          {GROUPS.map((group) => (
            <section key={group.heading} className="px-2 py-2">
              <h3 className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.heading}
              </h3>
              <ul className="divide-y divide-border/40 rounded-lg border border-border/40 overflow-hidden">
                {group.rows.map((row) => (
                  <li
                    key={row.keys + row.desc}
                    className="flex items-center justify-between gap-3 px-3 py-2 bg-card/50"
                  >
                    <span className="text-sm text-foreground/90">{row.desc}</span>
                    <kbd className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-1 font-mono text-[11px] text-muted-foreground">
                      {row.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

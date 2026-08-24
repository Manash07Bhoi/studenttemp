'use client'

/**
 * CommandPalette — Cmd/Ctrl+K power-user action launcher.
 *
 * Uses the shadcn `Command` (cmdk) primitive wrapped in a `Dialog`. The open
 * state lives in the Zustand store so the keyboard-shortcuts hook and the
 * header ⌘K button can both drive it.
 *
 * Surfaces:
 *   - Navigation actions (Inbox / Messages / Addresses / Compose / Settings / About)
 *   - Quick actions (Generate inbox, Copy active email, Refresh messages,
 *     Toggle theme, Lock now [if appLockEnabled])
 *   - Inbox switcher (one item per active inbox)
 *   - Search messages (only when the user is already on the Messages section)
 *
 * Filter as you type, navigate with arrow keys, confirm with Enter (cmdk
 * handles this natively). Esc closes (Radix handles this natively).
 */
import * as React from 'react'
import { useTheme } from 'next-themes'
import {
  Mail, Activity, AtSign, Plus, Settings as SettingsIcon, Info,
  Sparkles, Copy, RefreshCw, Sun, Moon, Lock, Search, Keyboard,
} from 'lucide-react'
import { useAppStore, type SectionId } from '@/lib/store'
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandShortcut, CommandSeparator,
} from '@/components/ui/command'
import { toast } from 'sonner'

export function CommandPalette() {
  const open = useAppStore((s) => s.commandPaletteOpen)
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen)
  const setActiveSection = useAppStore((s) => s.setActiveSection)
  const activeSection = useAppStore((s) => s.activeSection)
  const activeInboxId = useAppStore((s) => s.activeInboxId)
  const inboxes = useAppStore((s) => s.inboxes)
  const setActiveInboxId = useAppStore((s) => s.setActiveInboxId)
  const setOpenMessageId = useAppStore((s) => s.setOpenMessageId)
  const appLockEnabled = useAppStore((s) => s.appLockEnabled)
  const setLocked = useAppStore((s) => s.setLocked)
  const setShortcutsDialogOpen = useAppStore((s) => s.setShortcutsDialogOpen)
  const { resolvedTheme, setTheme } = useTheme()

  const close = React.useCallback(() => setOpen(false), [setOpen])

  const navigate = React.useCallback(
    (section: SectionId) => {
      setActiveSection(section)
      if (section === 'messages') setOpenMessageId(null)
      close()
    },
    [setActiveSection, setOpenMessageId, close]
  )

  const copyActiveEmail = React.useCallback(async () => {
    const inbox = inboxes.find((i) => i.id === activeInboxId)
    if (!inbox) {
      toast.error('No active inbox to copy')
      close()
      return
    }
    try {
      await navigator.clipboard.writeText(inbox.email)
      toast.success('Copied to clipboard', { description: inbox.email, duration: 1800 })
    } catch {
      toast.error('Could not copy — please copy manually')
    }
    close()
  }, [inboxes, activeInboxId, close])

  const generateInbox = React.useCallback(() => {
    close()
    // Defer so the palette animation completes before the network call
    // kicks off (better perceived responsiveness).
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('studenttemp:generate-inbox'))
    }, 50)
  }, [close])

  const refreshMessages = React.useCallback(() => {
    close()
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('studenttemp:refresh-messages'))
    }, 50)
  }, [close])

  const toggleTheme = React.useCallback(() => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    toast.success(`Switched to ${next} theme`, { duration: 1500 })
    close()
  }, [resolvedTheme, setTheme, close])

  const lockNow = React.useCallback(() => {
    if (!appLockEnabled) return
    close()
    setTimeout(() => {
      setLocked(true)
    }, 50)
  }, [appLockEnabled, setLocked, close])

  const showShortcuts = React.useCallback(() => {
    close()
    // Defer so the palette closes first; otherwise two overlapping dialogs
    // can fight for focus.
    setTimeout(() => setShortcutsDialogOpen(true), 80)
  }, [close, setShortcutsDialogOpen])

  const focusMessageSearch = React.useCallback(() => {
    close()
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('studenttemp:focus-search'))
    }, 50)
  }, [close])

  const switchInbox = React.useCallback(
    (id: string) => {
      setActiveInboxId(id)
      close()
      toast.success('Switched inbox', { duration: 1200 })
    },
    [setActiveInboxId, close]
  )

  const hasActiveInbox = !!inboxes.find((i) => i.id === activeInboxId)

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search for a command to run…"
      className="sm:max-w-[560px]"
    >
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No matching commands.</CommandEmpty>

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => navigate('inbox')} value="go to inbox">
            <Mail className="text-emerald-500" />
            <span>Go to Inbox</span>
            <CommandShortcut>g i</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigate('messages')} value="go to messages">
            <Activity className="text-emerald-500" />
            <span>Go to Messages</span>
            <CommandShortcut>g m</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigate('addresses')} value="go to addresses">
            <AtSign className="text-emerald-500" />
            <span>Go to Addresses</span>
            <CommandShortcut>g a</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigate('compose')} value="go to compose">
            <Plus className="text-emerald-500" />
            <span>Go to Compose</span>
            <CommandShortcut>g c</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigate('settings')} value="go to settings">
            <SettingsIcon className="text-emerald-500" />
            <span>Go to Settings</span>
            <CommandShortcut>g s</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigate('about')} value="go to about">
            <Info className="text-emerald-500" />
            <span>Go to About</span>
            <CommandShortcut>g ?</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Quick actions */}
        <CommandGroup heading="Actions">
          <CommandItem onSelect={generateInbox} value="generate new inbox">
            <Sparkles className="text-emerald-500" />
            <span>Generate new inbox</span>
            <CommandShortcut>n</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={copyActiveEmail} value="copy active email" disabled={!hasActiveInbox}>
            <Copy className="text-emerald-500" />
            <span>Copy active email</span>
            <CommandShortcut>c</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={refreshMessages} value="refresh messages">
            <RefreshCw className="text-emerald-500" />
            <span>Refresh messages</span>
            <CommandShortcut>r</CommandShortcut>
          </CommandItem>
          {activeSection === 'messages' && (
            <CommandItem onSelect={focusMessageSearch} value="search messages">
              <Search className="text-emerald-500" />
              <span>Search messages</span>
              <CommandShortcut>/</CommandShortcut>
            </CommandItem>
          )}
          <CommandItem onSelect={toggleTheme} value="toggle theme">
            {resolvedTheme === 'dark' ? (
              <Sun className="text-amber-500" />
            ) : (
              <Moon className="text-cyan-600" />
            )}
            <span>Toggle theme</span>
          </CommandItem>
          {appLockEnabled && (
            <CommandItem onSelect={lockNow} value="lock now">
              <Lock className="text-red-500" />
              <span>Lock now</span>
            </CommandItem>
          )}
          <CommandItem onSelect={showShortcuts} value="show keyboard shortcuts">
            <Keyboard className="text-emerald-500" />
            <span>Show keyboard shortcuts</span>
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {/* Inbox switcher */}
        {inboxes.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Switch inbox">
              {inboxes.map((inbox) => {
                const active = inbox.id === activeInboxId
                return (
                  <CommandItem
                    key={inbox.id}
                    onSelect={() => switchInbox(inbox.id)}
                    value={`inbox ${inbox.email} ${inbox.localPart}`}
                  >
                    <AtSign className={active ? 'text-emerald-500' : 'text-muted-foreground'} />
                    <span className="font-mono text-xs truncate">{inbox.email}</span>
                    {active && (
                      <span className="ml-auto text-[10px] uppercase tracking-wider text-emerald-500 font-bold">
                        active
                      </span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}

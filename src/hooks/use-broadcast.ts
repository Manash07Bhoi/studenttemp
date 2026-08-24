'use client'

import { useEffect } from 'react'

type BroadcastPayload =
  | { type: 'message:new'; msg: import('@/lib/types').RealtimeMessage }
  | { type: 'inbox:expired'; data: { inboxId: string; email: string } }
  | { type: 'message:updated'; id: string; patch: Partial<import('@/lib/types').MessageSummary> }
  | { type: 'message:deleted'; id: string }
  | { type: 'inbox:deleted'; id: string }

/**
 * Listen for BroadcastChannel events from other tabs of this origin.
 * Used for multi-tab sync per WORKFLOWS.md H4.
 */
export function useBroadcastChannel(handler: (payload: BroadcastPayload) => void) {
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel('studenttemp')
    const onMsg = (e: MessageEvent) => handler(e.data as BroadcastPayload)
    channel.addEventListener('message', onMsg)
    return () => channel.removeEventListener('message', onMsg)
  }, [handler])
}

export function broadcast(payload: BroadcastPayload) {
  if (typeof BroadcastChannel === 'undefined') return
  try {
    new BroadcastChannel('studenttemp').postMessage(payload)
  } catch {}
}

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { RealtimeMessage } from '@/lib/types'

interface UseSocketOptions {
  sessionId?: string
  onMessage?: (msg: RealtimeMessage) => void
  onInboxExpired?: (data: { inboxId: string; email: string }) => void
}

/**
 * Connects to the mail-service WebSocket (port 3003 via Caddy gateway).
 * Returns helpers to subscribe/unsubscribe to specific inboxes.
 */
export function useSocket(opts: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [activeEmail, setActiveEmail] = useState<string | null>(null)
  const onMessageRef = useRef(opts.onMessage)
  const onInboxExpiredRef = useRef(opts.onInboxExpired)
  useEffect(() => {
    onMessageRef.current = opts.onMessage
    onInboxExpiredRef.current = opts.onInboxExpired
  })

  useEffect(() => {
    // Connect to the Socket.IO gateway on the SAME HTTPS origin as the page.
    // The query parameter `XTransformPort` tells Caddy which upstream to use.
    // Because the page is served over HTTPS, socket.io-client will upgrade
    // to wss:// automatically; we force websocket transport for security.
    const socketUrl = process.env.NEXT_PUBLIC_MAIL_SERVICE_URL || "/?XTransformPort=3003";
    const socket = io(socketUrl, {
      path: "/socket.io/",
      transports: ['websocket'],
      // `secure: true` forces the wss:// scheme even if the page is on
      // a non-standard port (e.g. https://localhost:81).
      secure: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      timeout: 10000,
    })
    socketRef.current = socket

    socket.on('connect', () => setIsConnected(true))
    socket.on('disconnect', () => setIsConnected(false))

    socket.on('message:new', (msg: RealtimeMessage) => {
      onMessageRef.current?.(msg)
      // Broadcast to other tabs of this origin (multi-tab sync per WORKFLOWS.md H4)
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          new BroadcastChannel('studenttemp').postMessage({ type: 'message:new', msg })
        } catch {}
      }
    })
    socket.on('inbox:expired', (data: { inboxId: string; email: string }) => {
      onInboxExpiredRef.current?.(data)
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          new BroadcastChannel('studenttemp').postMessage({ type: 'inbox:expired', data })
        } catch {}
      }
    })

    if (opts.sessionId) {
      socket.emit('session:subscribe', { sessionId: opts.sessionId })
    }

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  useEffect(() => {
    if (socketRef.current && opts.sessionId && isConnected) {
      socketRef.current.emit('session:subscribe', { sessionId: opts.sessionId })
    }
  }, [opts.sessionId, isConnected])

  const subscribeInbox = useCallback((email: string | null) => {
    const sock = socketRef.current
    if (!sock) return
    if (activeEmail && activeEmail !== email) {
      sock.emit('inbox:unsubscribe', { email: activeEmail })
    }
    if (email) {
      sock.emit('inbox:subscribe', { email })
      setActiveEmail(email)
    } else {
      setActiveEmail(null)
    }
  }, [activeEmail])

  const triggerGenerate = useCallback((email: string) => {
    socketRef.current?.emit('inbox:generate', { email })
  }, [])

  return { isConnected, subscribeInbox, triggerGenerate }
}

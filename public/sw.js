// StudentTemp Service Worker
// - Enables PWA installability
// - Enables Web Push notifications (PushManager requires a service worker)
// - Minimal offline shell (does not cache dynamic API data — temp mail must always be fresh)

const CACHE_NAME = 'studenttemp-shell-v2'
const OFFLINE_URL = '/'

self.addEventListener('install', (event) => {
  // Skip waiting to activate the new SW immediately
  self.skipWaiting()
  // Don't pre-cache — we'll cache on first fetch
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      // Delete ALL old caches (including v1) to prevent stale content
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => {
        console.log('[sw] deleting old cache:', n)
        return caches.delete(n)
      }))
    ).then(() => self.clients.claim())
      .then(() => self.clients.matchAll().then(clients => {
        // Notify all clients to reload so they pick up the new SW
        clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }))
      }))
  )
})

// Network-first for navigation, cache fallback when offline.
// API requests are always network (never cached — temp mail must be fresh).
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Never intercept API or Socket.IO
  if (url.pathname.startsWith('/api/') || url.pathname.includes('socket.io')) return

  // Network-first for navigation
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {})
          return response
        })
        .catch(() => caches.match(request).then((r) => r || caches.match(OFFLINE_URL)))
    )
    return
  }

  // Network-first for static assets too (prevents stale JS/CSS in dev)
  if (['style', 'script', 'image', 'font'].includes(request.destination)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {})
          }
          return response
        })
        .catch(() => caches.match(request))
    )
  }
})

// Handle push events — show a content-free notification per SECURITY.md §35
self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data ? event.data.json() : {} } catch {}

  const title = payload.title || 'New email received'
  const options = {
    body: payload.body || 'You have new mail in your StudentTemp inbox',
    icon: '/logo.svg',
    badge: '/logo.svg',
    tag: payload.tag || 'studenttemp-new-mail',
    data: payload.data || {},
    // No message content in the payload per privacy rules
    requireInteraction: false,
    silent: false,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Notification click — focus/open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow('/')
    })
  )
})

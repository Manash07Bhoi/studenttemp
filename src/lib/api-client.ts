// Typed API client for StudentTemp
import type {
  DomainsResponse, Inbox, MessageSummary, MessageFull, SessionStats, LegalDoc,
} from './types'

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data as T
}

export const api = {
  getDomains: () => req<DomainsResponse>('/api/domains'),

  listInboxes: () => req<{ inboxes: Inbox[] }>('/api/inboxes'),
  createInbox: (body: {
    domain: string
    lifetimeMinutes: number
    category?: string
    customLocalPart?: string
    burnOnRead?: boolean
  }) => req<{ inbox: Inbox }>('/api/inboxes', { method: 'POST', body: JSON.stringify(body) }),
  getInbox: (id: string) => req<{ inbox: Inbox }>(`/api/inboxes/${id}`),
  deleteInbox: (id: string) => req<{ ok: boolean }>(`/api/inboxes/${id}`, { method: 'DELETE' }),
  extendInbox: (id: string, extendMinutes: number) =>
    req<{ inbox: Inbox }>(`/api/inboxes/${id}`, { method: 'PATCH', body: JSON.stringify({ extendMinutes }) }),

  listMessages: (inboxId: string) =>
    req<{ messages: MessageSummary[]; unread: number; total: number }>(`/api/inboxes/${inboxId}/messages`),
  getMessage: (id: string) => req<{ message: MessageFull; burned: boolean }>(`/api/messages/${id}`),
  updateMessage: (id: string, data: { isRead?: boolean; isStarred?: boolean }) =>
    req<{ message: MessageFull }>(`/api/messages/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMessage: (id: string) => req<{ ok: boolean }>(`/api/messages/${id}`, { method: 'DELETE' }),
  reportMessage: (id: string, reason: string, category: string) =>
    req<{ ok: boolean }>(`/api/messages/${id}/report`, { method: 'POST', body: JSON.stringify({ reason, category }) }),
  attachmentUrl: (msgId: string, attId: string) => `/api/messages/${msgId}/attachments/${attId}`,

  checkAlias: (localPart: string, domain: string) =>
    req<{ available: boolean; reason?: string; email?: string }>('/api/check-alias', {
      method: 'POST',
      body: JSON.stringify({ localPart, domain }),
    }),

  getStats: () => req<SessionStats>('/api/stats'),
  getSession: () => req<{ session: { id: string; createdAt: string; expiresAt: string; maxInboxes: number; locale: string; _count: { inboxes: number } } }>('/api/session'),
  recoverSession: (code: string) =>
    req<{ ok: boolean; sessionId: string }>('/api/session', { method: 'POST', body: JSON.stringify({ code }) }),

  sendMail: (body: { inboxId: string; to: string; subject: string; text: string; html?: string }) =>
    req<{ ok: boolean; messageId: string; response: string }>('/api/send-mail', {
      method: 'POST', body: JSON.stringify(body),
    }),

  subscribePush: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    req<{ ok: boolean; id: string }>('/api/notifications/subscribe', {
      method: 'POST', body: JSON.stringify(sub),
    }),
  unsubscribePush: (endpoint?: string) =>
    req<{ ok: boolean }>('/api/notifications/subscribe', {
      method: 'DELETE', body: JSON.stringify({ endpoint }),
    }),

  getLegal: (doc: string) => req<LegalDoc>(`/api/legal/${doc}`),
}

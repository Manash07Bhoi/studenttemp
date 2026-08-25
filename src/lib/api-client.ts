// Typed API client for StudentTemp
import type {
  DomainsResponse, Inbox, MessageSummary, MessageFull, SessionStats, LegalDoc,
  AnalyticsResponse,
} from './types'

/**
 * ApiError — extends the standard Error with the server-provided `code` field
 * (e.g. 'INBOX_EXPIRED', 'INBOX_NOT_FOUND') and the HTTP `status`. Lets calling
 * code distinguish recoverable "not found" 404s from "expired" 410s without
 * parsing message strings.
 *
 * Per GAP-ANALYSIS-V2.md L1: when a request is in-flight exactly as an inbox
 * expires, the server returns `{ code: 'INBOX_EXPIRED' }` with status 410 —
 * the client uses this code to transition straight to the Expired screen
 * instead of showing a generic error/retry UI.
 */
export class ApiError extends Error {
  code?: string
  status: number
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `Request failed (${res.status})`
    throw new ApiError(msg, res.status, data?.code)
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
  sendPushNotification: (data: { title: string; body: string; inboxId?: string }) =>
    req<{ ok: boolean; sent: number; failed: number }>('/api/notifications/send', {
      method: 'POST', body: JSON.stringify(data),
    }),

  getLegal: (doc: string) => req<LegalDoc>(`/api/legal/${doc}`),

  getAnalytics: (rangeDays: number) =>
    req<AnalyticsResponse>(`/api/analytics?rangeDays=${rangeDays}`),

  // ===== Account Mode APIs (Phase 12) =====
  auth: {
    signup: (body: { fullName: string; username: string; domain: string; password: string; recoveryEmail?: string; recoveryPhone?: string }) =>
      req<{ ok: boolean; account: { id: string; email: string; displayName: string } }>('/api/auth/signup', {
        method: 'POST', body: JSON.stringify(body),
      }),
    login: (body: { email: string; password: string; totpCode?: string }) =>
      req<{ ok: boolean; account: { id: string; email: string; displayName: string; totpEnabled: boolean } }>('/api/auth/login', {
        method: 'POST', body: JSON.stringify(body),
      }),
    logout: () => req<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
    me: () => req<{ account: { id: string; email: string; displayName: string; phone: string | null; recoveryEmail: string | null; recoveryPhone: string | null; totpEnabled: boolean; storageQuotaBytes: string; storageUsedBytes: string; status: string; createdAt: string } | null }>('/api/auth/me'),
  },

  // Labels
  labels: {
    list: () => req<{ labels: Array<{ id: string; name: string; color: string; retentionDays: number | null; isSystemLabel: boolean; parentLabelId: string | null }> }>('/api/accounts/labels'),
    create: (body: { name: string; color?: string; retentionDays?: number | null; parentLabelId?: string | null }) =>
      req<{ ok: boolean; label: { id: string } }>('/api/accounts/labels', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { name?: string; color?: string; retentionDays?: number | null }) =>
      req<{ ok: boolean }>(`/api/accounts/labels`, { method: 'PATCH', body: JSON.stringify({ id, ...body }) }),
    delete: (id: string) =>
      req<{ ok: boolean }>(`/api/accounts/labels?id=${id}`, { method: 'DELETE' }),
  },

  // Filters
  filters: {
    list: () => req<{ filters: Array<{ id: string; priorityOrder: number; conditions: string; actions: string; stopProcessing: boolean }> }>('/api/accounts/filters'),
    create: (body: { conditions: Array<{ field: string; operator: string; value: string }>; actions: Array<{ type: string; value?: string }>; stopProcessing?: boolean }) =>
      req<{ ok: boolean; filter: { id: string } }>('/api/accounts/filters', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: string) =>
      req<{ ok: boolean }>(`/api/accounts/filters?id=${id}`, { method: 'DELETE' }),
  },

  // Contacts
  contacts: {
    list: () => req<{ contacts: Array<{ id: string; name: string; email: string; groupName: string | null; source: string }> }>('/api/accounts/contacts'),
    create: (body: { name: string; email: string; groupName?: string }) =>
      req<{ ok: boolean; contact: { id: string } }>('/api/accounts/contacts', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: string) =>
      req<{ ok: boolean }>(`/api/accounts/contacts?id=${id}`, { method: 'DELETE' }),
  },

  // Sessions
  sessions: {
    list: () => req<{ sessions: Array<{ id: string; deviceInfo: string; ipHash: string | null; createdAt: string; lastSeenAt: string; revoked: boolean }> }>('/api/accounts/sessions'),
    revoke: (id: string) =>
      req<{ ok: boolean }>(`/api/accounts/sessions?id=${id}`, { method: 'DELETE' }),
  },

  // Vacation responder
  vacation: {
    get: () => req<{ vacationResponder: { enabled: boolean; startDate: string | null; endDate: string | null; subject: string; body: string; contactsOnly: boolean } | null }>('/api/accounts/vacation'),
    update: (body: { enabled: boolean; startDate?: string | null; endDate?: string | null; subject?: string; body?: string; contactsOnly?: boolean }) =>
      req<{ ok: boolean }>('/api/accounts/vacation', { method: 'PUT', body: JSON.stringify(body) }),
  },

  // Account deletion (L5)
  deleteAccount: (confirmPhrase: string) =>
    req<{ ok: boolean; message: string; deletionDate: string }>('/api/accounts/delete', {
      method: 'POST', body: JSON.stringify({ confirmPhrase }),
    }),

  // Admin dashboard
  admin: {
    stats: () => req<{
      overview: { totalAccounts: number; activeAccounts: number; totalInboxes: number; activeInboxes: number; permanentInboxes: number; totalMessages: number; messages24h: number; totalAttachments: number; abuseReports: number; domains: number; totalStorageUsed: string };
      accountMode: { filters: number; labels: number; contacts: number; sentMessages: number; drafts: number; activeSessions: number };
      abuse: { total: number; byCategory: Array<{ category: string; _count: number }> };
      timestamp: string;
    }>('/api/admin/stats'),
  },

  // Account inboxes (permanent / time-limited)
  accountInboxes: {
    list: () => req<{ inboxes: Inbox[] }>('/api/accounts/inboxes'),
    create: (body: { domain: string; plan: string; customLocalPart?: string }) =>
      req<{ inbox: Inbox }>('/api/accounts/inboxes', { method: 'POST', body: JSON.stringify(body) }),
  },

  // Sent messages
  sent: {
    list: () => req<{ sentMessages: Array<{ id: string; to: string; subject: string; sentAt: string; status: string }> }>('/api/accounts/sent'),
  },

  // Drafts
  drafts: {
    list: () => req<{ drafts: Array<{ id: string; to: string; subject: string; body: string; lastSavedAt: string }> }>('/api/accounts/drafts'),
  },

  // Aliases (G9)
  aliases: {
    list: () => req<{ aliases: Array<{ id: string; aliasAddress: string; signature: string | null; active: boolean }> }>('/api/accounts/aliases'),
    create: (body: { aliasAddress: string; signature?: string }) =>
      req<{ ok: boolean; alias: { id: string } }>('/api/accounts/aliases', { method: 'POST', body: JSON.stringify(body) }),
  },
}

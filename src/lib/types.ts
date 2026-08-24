// Shared frontend types for StudentTemp

export interface DomainInfo {
  domain: string
  label: string
  badge: string
  popular: boolean
}

export interface LifetimeOption {
  value: number
  label: string
  default?: boolean
}

export interface CategoryPreset {
  value: string
  label: string
  desc: string
}

export interface Quotas {
  MAX_ACTIVE_INBOXES_PER_SESSION: number
  MAX_MESSAGES_PER_INBOX: number
  DEFAULT_LIFETIME_MIN: number
}

export interface Inbox {
  id: string
  email: string
  localPart: string
  domain: string
  isCustom: boolean
  category: string
  expiresAt: string
  createdAt: string
  updatedAt: string
  burnOnRead: boolean
  _count?: { messages: number }
}

export interface MessageSummary {
  id: string
  fromEmail: string
  fromName: string
  subject: string
  previewText: string
  isRead: boolean
  isStarred: boolean
  receivedAt: string
  category: string
  hasAttachment: boolean
  scanStatus: string
  spf: string
  dkim: string
  dmarc: string
  externalResourcesBlocked: number
  isReported: boolean
}

export interface MessageFull extends MessageSummary {
  bodyText: string
  bodyHtml: string
  attachments: Array<{ name: string; size: number; type: string }>
  inboxId: string
}

export interface SessionStats {
  session: { activeInboxes: number; totalInboxes: number; totalMessages: number; unreadMessages: number }
  global: { activeInboxes: number; totalMessages: number }
}

export interface RealtimeMessage {
  id: string
  inboxId: string
  email: string
  fromEmail: string
  fromName: string
  subject: string
  previewText: string
  receivedAt: string
  category: string
  isRead: boolean
  hasAttachment: boolean
  scanStatus: string
}

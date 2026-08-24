// Shared frontend types for StudentTemp — aligned with real Prisma schema

export interface DomainInfo {
  domain: string
  label: string
  badge: string
  popular: boolean
  pack: string
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
  MAX_MESSAGE_SIZE: number
  MAX_ATTACHMENT_SIZE: number
  MAX_ATTACHMENT_TOTAL: number
}

export interface SmtpInfo {
  host: string
  port: number
  domains: string[]
}

export interface DomainsResponse {
  domains: DomainInfo[]
  lifetimeOptions: LifetimeOption[]
  categories: CategoryPreset[]
  quotas: Quotas
  smtp: SmtpInfo
}

export interface Inbox {
  id: string
  publicId: string
  email: string
  localPart: string
  domainId: string
  domain?: { domain: string; pack: string }
  isCustomAlias: boolean
  status: string
  category: string
  burnOnRead: boolean
  createdAt: string
  expiresAt: string
  lastActivityAt: string
  messageCount: number
  maxMessages: number
  _count?: { messages: number }
}

export interface MessageSummary {
  id: string
  publicId: string
  fromEmail: string
  fromName: string
  senderAddress: string
  senderDisplayName: string | null
  subject: string
  previewText: string
  isRead: boolean
  isStarred: boolean
  receivedAt: string
  hasAttachment: boolean
  scanStatus: string
  spf: string
  dkim: string
  dmarc: string
  externalResourcesBlocked: number
  isReported: boolean
  sizeBytes: number
  category: string
}

export interface Attachment {
  id: string
  filename: string
  originalFilename: string | null
  mimeType: string
  sizeBytes: number
  sha256: string
  scanStatus: string
}

export interface AuthDetails {
  spf?: { status?: string; comment?: string; [k: string]: unknown }
  dkim?: { results?: Array<{ status?: { result?: string }; signing_domain?: string; selector?: string }> }
  dmarc?: { result?: string; policy?: string; [k: string]: unknown }
}

export interface MessageFull extends MessageSummary {
  bodyText: string
  bodyHtml: string
  smtpMessageId: string | null
  senderIp: string | null
  sizeBytes: number
  authSpf: string
  authDkim: string
  authDmarc: string
  authDetails: AuthDetails
  attachments: Attachment[]
  inboxId: string
}

export interface SessionStats {
  session: { activeInboxes: number; totalInboxes: number; totalMessages: number; unreadMessages: number }
  global: { activeInboxes: number; totalMessages: number; domains: number }
}

export interface RealtimeMessage {
  id: string
  publicId: string
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
  spf: string
  dkim: string
  dmarc: string
}

export interface LegalDoc {
  title: string
  updated: string
  body: string
}

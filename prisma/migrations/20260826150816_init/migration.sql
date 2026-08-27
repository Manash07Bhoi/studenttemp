-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxInboxes" INTEGER NOT NULL DEFAULT 5,
    "locale" TEXT NOT NULL DEFAULT 'en'
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domain" TEXT NOT NULL,
    "pack" TEXT NOT NULL DEFAULT 'standard',
    "country" TEXT NOT NULL DEFAULT 'global',
    "category" TEXT NOT NULL DEFAULT 'general',
    "mxEnabled" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "reputationScore" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Inbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicId" TEXT NOT NULL,
    "sessionId" TEXT,
    "accountId" TEXT,
    "email" TEXT NOT NULL,
    "localPart" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "isCustomAlias" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "category" TEXT NOT NULL DEFAULT 'general',
    "burnOnRead" BOOLEAN NOT NULL DEFAULT false,
    "isPermanent" BOOLEAN NOT NULL DEFAULT false,
    "planDuration" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "maxMessages" INTEGER NOT NULL DEFAULT 100,
    CONSTRAINT "Inbox_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Inbox_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Inbox_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "localPart" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "lastUsedBySessionHash" TEXT,
    "cooldownUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicId" TEXT NOT NULL,
    "inboxId" TEXT NOT NULL,
    "smtpMessageId" TEXT,
    "senderAddress" TEXT NOT NULL,
    "senderDisplayName" TEXT,
    "senderIp" TEXT,
    "subject" TEXT NOT NULL,
    "previewText" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "hasHtml" BOOLEAN NOT NULL DEFAULT false,
    "hasText" BOOLEAN NOT NULL DEFAULT false,
    "hasAttachment" BOOLEAN NOT NULL DEFAULT false,
    "authSpf" TEXT NOT NULL DEFAULT 'none',
    "authDkim" TEXT NOT NULL DEFAULT 'none',
    "authDmarc" TEXT NOT NULL DEFAULT 'none',
    "authDetails" TEXT NOT NULL DEFAULT '{}',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "isReported" BOOLEAN NOT NULL DEFAULT false,
    "scanStatus" TEXT NOT NULL DEFAULT 'clean',
    "externalResourcesBlocked" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Message_inboxId_fkey" FOREIGN KEY ("inboxId") REFERENCES "Inbox" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalFilename" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "scanStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AbuseReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'spam',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AbuseReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "count" INTEGER NOT NULL DEFAULT 0,
    "limit" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "NotificationSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationSubscription_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT,
    "accountId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarKey" TEXT,
    "recoveryEmail" TEXT,
    "recoveryPhone" TEXT,
    "totpSecretEncrypted" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "storageQuotaBytes" BIGINT NOT NULL DEFAULT 5368709120,
    "storageUsedBytes" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "deletionScheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Label" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#10b981',
    "retentionDays" INTEGER,
    "isSystemLabel" BOOLEAN NOT NULL DEFAULT false,
    "parentLabelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Label_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Label_parentLabelId_fkey" FOREIGN KEY ("parentLabelId") REFERENCES "Label" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Filter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "priorityOrder" INTEGER NOT NULL DEFAULT 0,
    "conditions" TEXT NOT NULL DEFAULT '[]',
    "actions" TEXT NOT NULL DEFAULT '[]',
    "stopProcessing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Filter_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "groupName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "to" TEXT NOT NULL DEFAULT '',
    "cc" TEXT NOT NULL DEFAULT '',
    "bcc" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "attachments" TEXT NOT NULL DEFAULT '[]',
    "lastSavedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Draft_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SentMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "cc" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relayProvider" TEXT,
    "relayMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "deliveredAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "bounceReason" TEXT,
    "trackingPixelId" TEXT,
    "firstOpenedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "mdnRequested" BOOLEAN NOT NULL DEFAULT false,
    "mdnReceivedAt" TIMESTAMP(3),
    "isConfidential" BOOLEAN NOT NULL DEFAULT false,
    "confidentialExpiresAt" TIMESTAMP(3),
    CONSTRAINT "SentMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccountAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "aliasAddress" TEXT NOT NULL,
    "signature" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountAlias_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoginSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "deviceInfo" TEXT NOT NULL DEFAULT '',
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "LoginSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BackupCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "BackupCode_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VacationResponder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "contactsOnly" BOOLEAN NOT NULL DEFAULT false,
    "repliedTo" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "VacationResponder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppPassword" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AppPassword_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_domain_key" ON "Domain"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "Inbox_publicId_key" ON "Inbox"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Inbox_email_key" ON "Inbox"("email");

-- CreateIndex
CREATE INDEX "Inbox_sessionId_idx" ON "Inbox"("sessionId");

-- CreateIndex
CREATE INDEX "Inbox_accountId_idx" ON "Inbox"("accountId");

-- CreateIndex
CREATE INDEX "Inbox_expiresAt_idx" ON "Inbox"("expiresAt");

-- CreateIndex
CREATE INDEX "Inbox_status_idx" ON "Inbox"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Inbox_localPart_domainId_status_key" ON "Inbox"("localPart", "domainId", "status");

-- CreateIndex
CREATE INDEX "CustomAlias_cooldownUntil_idx" ON "CustomAlias"("cooldownUntil");

-- CreateIndex
CREATE UNIQUE INDEX "CustomAlias_localPart_domainId_key" ON "CustomAlias"("localPart", "domainId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_publicId_key" ON "Message"("publicId");

-- CreateIndex
CREATE INDEX "Message_inboxId_idx" ON "Message"("inboxId");

-- CreateIndex
CREATE INDEX "Message_receivedAt_idx" ON "Message"("receivedAt");

-- CreateIndex
CREATE INDEX "Attachment_messageId_idx" ON "Attachment"("messageId");

-- CreateIndex
CREATE INDEX "Attachment_sha256_idx" ON "Attachment"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitBucket_key_key" ON "RateLimitBucket"("key");

-- CreateIndex
CREATE INDEX "NotificationSubscription_sessionId_idx" ON "NotificationSubscription"("sessionId");

-- CreateIndex
CREATE INDEX "AuditLog_sessionId_idx" ON "AuditLog"("sessionId");

-- CreateIndex
CREATE INDEX "AuditLog_accountId_idx" ON "AuditLog"("accountId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE INDEX "Label_accountId_idx" ON "Label"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Label_accountId_name_key" ON "Label"("accountId", "name");

-- CreateIndex
CREATE INDEX "Filter_accountId_idx" ON "Filter"("accountId");

-- CreateIndex
CREATE INDEX "Contact_accountId_idx" ON "Contact"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_accountId_email_key" ON "Contact"("accountId", "email");

-- CreateIndex
CREATE INDEX "Draft_accountId_idx" ON "Draft"("accountId");

-- CreateIndex
CREATE INDEX "SentMessage_accountId_idx" ON "SentMessage"("accountId");

-- CreateIndex
CREATE INDEX "SentMessage_sentAt_idx" ON "SentMessage"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountAlias_aliasAddress_key" ON "AccountAlias"("aliasAddress");

-- CreateIndex
CREATE INDEX "LoginSession_accountId_idx" ON "LoginSession"("accountId");

-- CreateIndex
CREATE INDEX "BackupCode_accountId_idx" ON "BackupCode"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "VacationResponder_accountId_key" ON "VacationResponder"("accountId");

-- CreateIndex
CREATE INDEX "AppPassword_accountId_idx" ON "AppPassword"("accountId");

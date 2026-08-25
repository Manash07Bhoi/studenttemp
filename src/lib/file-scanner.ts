// Free attachment scanner — ClamAV alternative that requires zero external infrastructure.
// This validates file types by reading actual file magic bytes (not trusting MIME header),
// enforces size limits, and blocks known-dangerous file types.
//
// In production with ClamAV available, this runs as a pre-filter before clamd scanning.
// Without ClamAV, this is the primary defense — it catches:
// - Executable files (.exe, .bat, .cmd, .scr, .com, .vbs, .js, .jar, .msi, .dll, .ps1)
// - Script files disguised as other types (e.g., .jpg that's actually .exe)
// - Files exceeding size limits
// - Files with mismatched extensions and actual content types

// Magic bytes signatures for common file types
const MAGIC_BYTES: Record<string, { offset: number; bytes: number[] }> = {
  // Images
  png: { offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47] },
  jpg: { offset: 0, bytes: [0xFF, 0xD8, 0xFF] },
  gif: { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  bmp: { offset: 0, bytes: [0x42, 0x4D] },
  webp: { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
  // Documents
  pdf: { offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  // Archives
  zip: { offset: 0, bytes: [0x50, 0x4B, 0x03, 0x04] }, // PK
  gzip: { offset: 0, bytes: [0x1F, 0x8B] },
  // Email
  eml: { offset: 0, bytes: [0x52, 0x65, 0x74, 0x75, 0x72, 0x6E] }, // "Return"
}

// File extensions that are ALWAYS blocked (dangerous executable/script types)
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.scr', '.com', '.vbs', '.js', '.jar',
  '.msi', '.dll', '.ps1', '.sh', '.app', '.deb', '.rpm', '.dmg',
  '.iso', '.img', '.run', '.bin', '.hta', '.cpl', '.wsf', '.lnk',
])

// Maximum allowed sizes (per GAP H6 quotas)
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB per file
const MAX_TOTAL_ATTACHMENTS = 15 * 1024 * 1024 // 15 MB total per message

export interface ScanResult {
  status: 'clean' | 'quarantined' | 'failed'
  reason?: string
  detectedType?: string
  declaredType?: string
}

export function scanFile(filename: string, content: Buffer, declaredMimeType: string): ScanResult {
  // 1. Check file extension against blocklist
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return {
      status: 'quarantined',
      reason: `File type "${ext}" is blocked for security`,
      declaredType: declaredMimeType,
    }
  }

  // 2. Check file size
  if (content.length > MAX_FILE_SIZE) {
    return {
      status: 'quarantined',
      reason: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      declaredType: declaredMimeType,
    }
  }

  // 3. Check magic bytes — detect actual file type
  let detectedType = 'unknown'
  for (const [type, sig] of Object.entries(MAGIC_BYTES)) {
    if (content.length >= sig.offset + sig.bytes.length) {
      const slice = content.slice(sig.offset, sig.offset + sig.bytes.length)
      const matches = sig.bytes.every((byte, i) => slice[i] === byte)
      if (matches) {
        detectedType = type
        break
      }
    }
  }

  // 4. Check for executable disguised as safe type
  // If the extension says .jpg but the magic bytes say .exe → quarantine
  const extToType: Record<string, string> = {
    '.png': 'png', '.jpg': 'jpg', '.jpeg': 'jpg', '.gif': 'gif',
    '.bmp': 'bmp', '.webp': 'webp', '.pdf': 'pdf', '.zip': 'zip',
    '.gz': 'gzip', '.eml': 'eml',
  }
  const expectedType = extToType[ext]
  if (expectedType && detectedType !== 'unknown' && detectedType !== expectedType) {
    return {
      status: 'quarantined',
      reason: `File extension "${ext}" does not match actual file type "${detectedType}" (possible disguised executable)`,
      detectedType,
      declaredType: declaredMimeType,
    }
  }

  // 5. Check for PE (Windows executable) header — even if extension is unknown
  if (content.length >= 2 && content[0] === 0x4D && content[1] === 0x5A) {
    return {
      status: 'quarantined',
      reason: 'Windows executable (PE) detected — blocked for security',
      detectedType: 'exe',
      declaredType: declaredMimeType,
    }
  }

  // 6. Check for ELF (Linux executable) header
  if (content.length >= 4 && content[0] === 0x7F && content[1] === 0x45 && content[2] === 0x4C && content[3] === 0x46) {
    return {
      status: 'quarantined',
      reason: 'Linux executable (ELF) detected — blocked for security',
      detectedType: 'elf',
      declaredType: declaredMimeType,
    }
  }

  // 7. Check for Mach-O (macOS executable) header
  if (content.length >= 4) {
    const magic = content.readUInt32BE(0)
    if (magic === 0xFEEDFACE || magic === 0xFEEDFACF || magic === 0xBEBAFECA) {
      return {
        status: 'quarantined',
        reason: 'macOS executable (Mach-O) detected — blocked for security',
        detectedType: 'macho',
        declaredType: declaredMimeType,
      }
    }
  }

  // All checks passed
  return {
    status: 'clean',
    detectedType,
    declaredType: declaredMimeType,
  }
}

export function getTotalAttachmentSize(attachments: Array<{ content: Buffer }>): number {
  return attachments.reduce((sum, a) => sum + a.content.length, 0)
}

export function validateTotalSize(attachments: Array<{ content: Buffer }>): boolean {
  return getTotalAttachmentSize(attachments) <= MAX_TOTAL_ATTACHMENTS
}

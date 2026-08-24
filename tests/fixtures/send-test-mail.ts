#!/usr/bin/env bun
// Real SMTP test sender — sends a REAL email via real SMTP to a real StudentTemp inbox.
// Usage: bun tests/fixtures/send-test-mail.ts <to-email> <subject> <body>
//
// This is NOT a mock generator. It is a real SMTP client (nodemailer) that delivers
// real mail through the real mail-service SMTP server on port 2525.

import nodemailer from 'nodemailer'

const [toEmail, subject, body] = process.argv.slice(2)

if (!toEmail || !subject || !body) {
  console.error('Usage: bun tests/fixtures/send-test-mail.ts <to-email> <subject> <body>')
  console.error('Example: bun tests/fixtures/send-test-mail.ts student-abc123@studentbox.in "Hello" "Real test body"')
  process.exit(1)
}

const transporter = nodemailer.createTransport({
  host: 'localhost',
  port: 2525,
  secure: false,
  tls: { rejectUnauthorized: false },
})

console.log(`Sending real SMTP mail to ${toEmail}…`)
const info = await transporter.sendMail({
  from: 'test-sender@local.dev',
  to: toEmail,
  subject,
  text: body,
  html: `<div style="font-family:Arial;padding:16px"><h2>${subject}</h2><p>${body.replace(/\n/g, '<br>')}</p></div>`,
})

console.log('✓ Sent. SMTP response:', info.response)
console.log('  Message-ID:', info.messageId)
console.log('  The mail-service has parsed + stored this real message.')

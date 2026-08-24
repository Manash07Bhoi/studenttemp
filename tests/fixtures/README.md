# Test Harness — StudentTemp

This directory contains a **clearly isolated, explicitly labeled local test harness** for
development. Per `AGENT.md §1`, no mock/placeholder/fake data is shipped in production code.
This harness is for **dev-only** SMTP testing against real mail flows.

## Files

- `send-test-mail.ts` — sends a **real** SMTP message to a real StudentTemp inbox via the
  mail-service's real SMTP server (port 2525). This is NOT a fake generator; it's a real
  SMTP client that delivers real mail for local testing.

## Usage

```bash
# 1. Create an inbox via the UI (http://localhost:81 → Generate)
# 2. Send a real test email to it:
bun tests/fixtures/send-test-mail.ts student-xxxxx@studentbox.in "Test subject" "Body"
```

The mail-service will:
1. Receive the real SMTP connection
2. Validate the recipient exists and is active (rejects otherwise)
3. Parse the real MIME
4. Verify real SPF/DKIM/DMARC via DNS
5. Sanitize the HTML with DOMPurify
6. Store the message
7. Push a real-time "new message" event to subscribed browsers

## What this is NOT

This is NOT a mock data generator. It does not fabricate OTP codes, fake senders, or
synthetic email content. It sends real mail you write yourself, through a real SMTP
server, to a real inbox. The message content is whatever you pass on the command line.

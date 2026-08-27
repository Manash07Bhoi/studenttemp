# Resend Webhook Configuration Guide

To complete the setup of incoming email using Resend Inbound Routing, follow these steps in your Resend Dashboard:

1.  Navigate to **Webhooks** in your Resend dashboard.
2.  Click **Add Webhook**.
3.  Set the **Endpoint URL** to your production URL:
    \`https://<your-production-domain>/api/webhooks/relay\`
    *(E.g., \`https://studenttemp-web.onrender.com/api/webhooks/relay\` if a custom domain isn't attached yet).*
4.  Under **Events to send**, check the box for \`email.received\`.
    *(You may also check \`email.delivered\` and \`email.bounced\` if outbound tracking is required).*
5.  Click **Add**.
6.  Once created, click the webhook to view its details and copy the **Signing Secret** (it starts with \`whsec_\`).
7.  In your **Render Dashboard** for the \`studenttemp-web\` service, add a new Environment Variable:
    *   **Key**: \`RESEND_WEBHOOK_SECRET\`
    *   **Value**: The \`whsec_...\` secret you copied.
8.  Add another Environment Variable to \`studenttemp-web\` AND \`studenttemp-mail\`:
    *   **Key**: \`INTERNAL_API_SECRET\`
    *   **Value**: A strong, random string (e.g., generate with \`openssl rand -hex 32\`). This secures the internal communication path.
9.  Add another Environment Variable to \`studenttemp-web\`:
    *   **Key**: \`INTERNAL_MAIL_SERVICE_URL\`
    *   **Value**: \`http://studenttemp-mail:3003\` (or the specific Render private service URL).

## DNS & Inbound Mail Setup

In the Resend dashboard under **Domains**:
1.  Add your receiving domain.
2.  Add the MX records provided by Resend to your domain's DNS settings.
3.  Ensure SPF, DKIM, and DMARC records are configured as instructed by Resend.

# StudentTemp — Advanced Disposable Email Platform

![StudentTemp Hero](public/og-image.png)

**StudentTemp** is a premium, privacy-first disposable email service engineered specifically for students, developers, and researchers. Built with modern, industry-level architecture, it offers a seamless and highly responsive interface to instantly generate throwaway email addresses, empowering you to bypass spam, protect your personal inbox, and safely verify online accounts.

## ✨ Premium Features
* **Lightning-Fast Generation:** Instantly spin up a temporary email address with zero registration required.
* **Real-Time Delivery:** Powered by a high-performance Socket.IO WebSocket architecture ensuring new emails land in your inbox the millisecond they are received.
* **Privacy First:** We don't track you. Temporary inboxes and their contents are securely stored in PostgreSQL and automatically eradicated based on strict TTL expirations.
* **Modern & Responsive UI:** A beautiful, accessible, and fluid user interface crafted with Next.js and shadcn/ui, adapting perfectly to desktop, tablet, and mobile devices.
* **Robust Security:** Protected by advanced API gateways, secure HTTP headers, and strict cryptographic webhook verifications to prevent abuse.

## 🚀 Architecture & Tech Stack
StudentTemp leverages a state-of-the-art serverless and containerized hybrid architecture:
* **Frontend:** Next.js 14, React, Tailwind CSS, shadcn/ui
* **Realtime Engine:** Node.js, Socket.IO
* **Database:** PostgreSQL via Prisma ORM
* **Inbound Mail Routing:** Resend / custom SMTP Webhooks with SVIX cryptographic verification
* **Infrastructure:** Render Cloud (Web Services + Private Networking)

## 📊 Deployment & World-Readiness Status
* **Infrastructure Health:** Fully configured and verified on Render (Web, Mail Socket Service, Database).
* **World-Readiness:** **NOT PRODUCTION READY** (Currently blocked by pending Registrar DNS).
  * *Note to contributors:* While all internal APIs, Socket.IO connections, and SVIX cryptographic hooks are fully tested and functional, the required **MX** and **TXT (SPF/DKIM)** DNS routing policies for the primary domain (`studentbox.in`) are not yet resolving. Live end-to-end inbound mail tests are suspended until DNS propagation completes.

---
*Developed with ❤️ to keep your inbox clean.*

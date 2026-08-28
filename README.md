# StudentTemp

![StudentTemp Hero](public/og-image.png)

**StudentTemp** is a next-generation, privacy-centric disposable email infrastructure tailored specifically for developers, researchers, and students. Engineered to deliver enterprise-grade performance and real-time reliability, it empowers users to instantly provision temporary, secure mailboxes to intercept verification codes, combat spam, and safeguard their primary identities across the web.

## 🚀 Architecture & Core Technologies
At the heart of StudentTemp lies a highly scalable, serverless-hybrid stack built for speed and security:
* **Frontend:** A fluid, accessible, and ultra-responsive user interface crafted with Next.js 14, React, Tailwind CSS, and shadcn/ui.
* **Real-Time Delivery Engine:** Node.js paired with an optimized Socket.IO WebSocket layer ensures that inbound messages materialize in the client exactly the moment they hit the server—no refreshing required.
* **Data Persistence:** Robust schema management via Prisma ORM backing into a secure PostgreSQL cluster, governed by strict TTL-based automatic data eradication.
* **Inbound Mail Routing:** Cryptographically signed and verified SVIX webhooks seamlessly orchestrate mail delivery from edge relays directly into our protected internal services.
* **Infrastructure:** Hosted globally on the Render Cloud, utilizing secure private networking and TLS edge-termination to guarantee an impenetrable backend ecosystem.

## ✨ Key Capabilities
* **Zero-Friction Provisioning:** Generate high-quality throwaway addresses in milliseconds with absolutely no registration required.
* **Cryptographic Security:** End-to-end webhook validation, secure Site-Access gating, and stringent CORS policies protect all ingress vectors from tampering and abuse.
* **Multi-Device Synchronization:** Automatically broadcast state updates and newly arriving mail payloads across multiple tabs and devices simultaneously.
* **Ephemeral by Design:** All sessions, mailboxes, and payloads are strictly ephemeral. Once the TTL expires, data vanishes entirely—leaving no trace.

## 📊 Deployment & World-Readiness Status
* **Infrastructure Health:** Fully configured and verified on Render (Web, Mail Socket Service, Database).
* **World-Readiness:** **NOT PRODUCTION READY** (Currently blocked by pending Registrar DNS).
  * *Note to contributors:* While all internal APIs, Socket.IO connections, and SVIX cryptographic hooks are fully tested and functional, the required **MX** and **TXT (SPF/DKIM)** DNS routing policies for the primary domain (`studentbox.in`) are not yet resolving. Live end-to-end inbound mail tests are suspended until DNS propagation completes.

---
*Built with precision and uncompromising standards to keep your inbox pristine.*

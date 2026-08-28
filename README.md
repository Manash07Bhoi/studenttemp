# StudentTemp
A privacy-first disposable email service.

## Status
* **Infrastructure**: Configured on Render (Web/Mail/Database).
* **World-Readiness**: **NOT PRODUCTION READY**.
  * The DNS routing for MX records (`studentbox.in`) is currently missing.
  * Live inbound E2E mail testing is blocked until DNS is fully propagated.
  * Internal architectures (Socket.IO, APIs, SVIX hooks) are tested and stable.

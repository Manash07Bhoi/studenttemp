## Platform Clarification

Based on everything written across the full documentation suite, here's the precise, honest answer:

## It's a **Website first — built as a Responsive Web App with PWA (installable) capability.** It is **not** a native mobile app (no iOS/Android app store build in this spec).

### Evidence from the docs itself:

| Doc Section | What it actually specifies |
|---|---|
| `PRD.md` header | "Target Platform: **Responsive Web Application / PWA**" — stated explicitly in the very first metadata block |
| §31 PWA | Manifest, Service Worker, install prompt, splash screen — this is **web-to-app-like**, not a native app build |
| `SCREENS.md` navigation | Hamburger menu, bottom nav, browser back-gesture handling, "PWA/Android back button" behavior — this is web navigation patterns *mimicking* app UX, not React Native/Flutter/native Swift-Kotlin code |
| `CI-CD.md` hosting | Cloudflare Pages, Vercel — these are **static/web hosting platforms**, not App Store/Play Store pipelines |
| `SECURITY.md` App Lock | Uses **WebAuthn** (browser biometric API) — not native Keychain/Android Keystore, confirming it's web-based |
| Nowhere in any file | There is no App Store/Play Store submission process, no native build tooling (Xcode/Android Studio/Gradle), no React Native/Flutter/Kotlin/Swift mentioned anywhere |

### So concretely, what you get:

- **A website** accessible via any browser (desktop + mobile)
- That is also **installable to a home screen** on Android/iOS/Desktop like an app (via PWA manifest + service worker) — giving an app-like icon, splash screen, and offline shell
- **Not** a real native app you'd submit to Google Play or Apple App Store
- **Not** built with React Native, Flutter, Swift, or Kotlin

---

## Why This Matters — And What You Should Decide Now

This distinction changes real things:

1. **"App Lock" via WebAuthn** works fine on a website/PWA, but is **weaker and less native-feeling** than a real biometric lock in a native app (no Face ID native API, no Android BiometricPrompt native integration — only what the browser exposes).
2. **Push notifications** work on Android PWA well, but **iOS Safari PWA push support is limited/newer and inconsistent** — this is a real constraint your users (especially iPhone students) will hit.
3. **No App Store/Play Store presence** means no app-store discoverability, no App Store optimization funnel — purely web/SEO-driven growth (which the PRD's SEO section §49 does correctly account for).
4. **"Complete app navigation," "back arrow," "hamburger menu," "gestures"** — all of this was written and *is valid*, but it's **web-app UX patterns**, not native OS navigation stacks (no native tab bar controller, no native navigation gesture APIs).

### Direct Question Back to You

Do you want me to:

**(A)** Keep it as-is — **Website + PWA only** (what's currently fully documented, 100% free-tier buildable, fastest to ship, works everywhere via browser) — recommended for MVP/launch speed, or

**(B)** Extend the PRD to **also cover a native mobile app** (React Native or Flutter) as a Phase 4+ addition — sharing the same backend/API — which would require additional docs (native app store submission SOP, native push via APNs/FCM properly, native biometric APIs, app store review compliance, native permissions model)?

Tell me which, and I'll either confirm (A) is final and production-ready as-is, or write the **additional native-app-specific PRD/SOP files** for (B) without breaking anything already built.

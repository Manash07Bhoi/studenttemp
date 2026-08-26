<!--
Thank you for opening a pull request! Please fill out every section below.
Incomplete PRs will be returned to draft until the checklist is satisfied.
-->

## Description

<!-- What does this PR do, and why? Reference issues with "Closes #123" or "Refs #456". -->

## Type of Change

Please check the option(s) that apply.

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing behavior to change)
- [ ] Refactor (no functional change)
- [ ] Performance improvement
- [ ] Documentation update
- [ ] Accessibility (a11y) improvement
- [ ] Internationalization (i18n) — new locale or translation fix
- [ ] Security hardening
- [ ] Chore / dependency bump
- [ ] Other (describe):

## Related Issues

<!-- "Closes #123", "Refs #456", or "N/A" -->

## How Has This Been Tested?

<!-- Describe what you ran to verify the change. For UI changes, list the
     breakpoints and devices you tested on. For API changes, include the
     curl / request you used. -->

- [ ] `bun run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] CI is green on this PR
- [ ] Manually reproduced the bug before fixing (for bug-fix PRs)
- [ ] Verified on mobile breakpoint
- [ ] Verified on desktop breakpoint
- [ ] Verified dark theme and light theme

## Checklist

Before requesting review, confirm all of the following:

- [ ] My code follows the project style (TypeScript strict, shadcn/ui for
      components, Lucide for icons, no new framework or styling system).
- [ ] I have not committed any secrets — `.env`, VAPID private keys,
      `TOTP_ENCRYPTION_KEY`, the site-access password, SMTP relay API keys,
      `cookies.txt`, or any production credential.
- [ ] If I changed the database, I updated `prisma/schema.prisma` and ran
      `bun run db:push` to verify the schema applies cleanly.
- [ ] If I added a new endpoint, I added input validation with Zod and a
      rate limit where the endpoint is security-sensitive.
- [ ] If I changed an existing API contract, I updated the affected
      frontend callers.
- [ ] If I touched security-sensitive code (auth, 2FA, sessions, mail
      sanitization, file scanning), I described the security implications
      in the Description above.
- [ ] I have not introduced a new production dependency without explaining
      why an existing one cannot do the job.
- [ ] My commits follow Conventional Commits and my branch is rebased on
      `main`.
- [ ] I have read `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`.

## Screenshots / Recordings

<!-- For UI changes only. Paste before / after screenshots or a short screen
     recording. -->

## Notes for Reviewers

<!-- Anything reviewers should pay extra attention to, tricky edge cases,
     or areas you want feedback on. -->

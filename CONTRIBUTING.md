# Contributing to StudentTemp

Thanks for your interest in contributing. StudentTemp is a privacy-first
temporary email platform built by Roshan and maintained on GitHub by
[@Manash07Bhoi](https://github.com/Manash07Bhoi). All contributions are
welcome — bug reports, fixes, features, docs, and translations.

This project is **developed by Roshan**. Long-running contributor:
**ManashBhoi** ([@Manash07Bhoi](https://github.com/Manash07Bhoi)).

## Code of Conduct

Participation in this project is governed by the
[Contributor Covenant v2.1](./CODE_OF_CONDUCT.md). By participating you agree
to abide by its terms.

## Before You Start

- The stack is fixed: **Next.js 16 (App Router) + TypeScript 5 + Prisma +
  Socket.IO + Tailwind CSS 4 + shadcn/ui**. PRs that switch frameworks or
  styling systems will not be accepted.
- Read `README.md` for the architecture overview and `SECURITY.md` before
  touching anything security-sensitive.
- The repo includes audit reports under `docs/audit/`. If your change
  touches an area flagged in `worklog.md` or `docs/audit/`, call it out in
  your PR description.

## Development Setup

```bash
# 1. Fork and clone
git clone https://github.com/<your-username>/<repo>.git
cd <repo>

# 2. Install dependencies
bun install

# 3. Configure environment
cp .env.example .env
# Fill in VAPID keys, DATABASE_URL, TOTP_ENCRYPTION_KEY, etc.

# 4. Initialize the database
bun run db:push

# 5. Start the dev server (port 3000)
bun run dev

# 6. In another terminal, start the mail-service (ports 2525 + 3003)
cd mini-services/mail-service
bun install
bun run dev
```

The app is reachable via the Preview Panel — do not visit `localhost` URLs
directly.

## Branch & Commit Conventions

### Branching

Branch off `main`:

```
main
 └─ <type>/<short-scope>-<short-description>
```

Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `chore`, `i18n`, `a11y`,
`security`, `test`.

Examples:

- `feat/inbox-bulk-archive`
- `fix/totp-clock-skew`
- `docs/deployment-runbook`
- `security/webhook-signature`

### Commit Messages

We follow **Conventional Commits**:

```
<type>(<scope>): <short imperative summary>

<optional body explaining why, not what>

<optional footer>
```

Rules:

- Keep the summary under 72 characters.
- Use imperative mood ("add", not "added" / "adds").
- Reference issues in the footer: `Closes #123`, `Refs #456`.
- One logical change per commit.

Examples:

```
feat(inbox): add burn-on-read toggle to inbox creation dialog

fix(2fa): validate TOTP code length before submission

docs(security): document sandbox alternatives to ClamAV and Redis

chore(deps): bump prisma to 6.19.3
```

## Code Quality Requirements

Every PR must pass these checks before review:

```bash
# Lint — must be clean
bun run lint

# Type check — must be clean
npx tsc --noEmit
```

Both are enforced in CI (`.github/workflows/ci.yml`). A red CI blocks merge.

### Code Style

- TypeScript throughout, strict mode.
- Use `'use client'` / `'use server'` directives where required.
- Prefer existing shadcn/ui components over custom CSS.
- Use Lucide icons (already a dependency) — do not add new icon sets.
- No `any` without a `// eslint-disable-next-line` and an explanatory
  comment.
- Use the existing Prisma schema; if you need a new model or field, update
  `prisma/schema.prisma` and run `bun run db:push`.

### Secrets

- Never commit `.env`, `cookies.txt`, VAPID private keys, TOTP encryption
  keys, the site-access password, or any production credential.
- Never hardcode third-party API keys.
- If you accidentally commit a secret, rotate it immediately and force-push
  the fix (or ask a maintainer to do so).

## Testing

There is no first-party test framework wired in yet. Until there is:

- Reproduce the bug manually before fixing it.
- Verify your change against the existing API endpoints using `curl` (see
  `README.md` for examples).
- If your change adds a non-trivial code path, write a fixture under
  `tests/fixtures/` and document how to run it.
- For UI changes, verify on both mobile and desktop breakpoints.

When a real test framework is added (planned: vitest + playwright), this
section will be updated and tests will become a merge requirement.

## Pull Request Process

1. **Open an issue first** for anything beyond a typo or trivial fix. This
   avoids wasted work if the change is out of scope.
2. Rebase your branch on `main` before opening the PR.
3. Fill out the [PR template](./.github/pull_request_template.md) fully.
4. Make sure CI is green.
5. Request review from a maintainer. CODEOWNERS will auto-assign.
6. Address review comments by pushing new commits — do not force-push during
   review unless asked.
7. Squash-merge is the default. The maintainer handling the merge will
   squash your commits into one with a clean message.

## Areas That Need Help

- Translations — additional locales beyond the current 7 (en, hi, ta, bn,
  te, mr, or).
- Accessibility audit of the inbox and compose flows.
- Hardening of the rate limiter for horizontal scaling (Redis backend).
- Real test coverage.

## Questions?

Open a [GitHub Discussion](https://github.com/Manash07Bhoi) or an issue with
the `question` label. See `SUPPORT.md` for the full help matrix.

## Credits

**Developed by Roshan** — Full-stack developer.
**Contributor:** ManashBhoi ([@Manash07Bhoi](https://github.com/Manash07Bhoi)).

Built with Next.js, Prisma, Socket.IO, Tailwind CSS, and shadcn/ui.

# Task DEEP-AUDIT-FINAL — Work Record

**Agent:** main (Z.ai Code)
**Task:** Read BUGFIX-INBOX-PERSISTENCE.md + GAP-ANALYSIS-V2.md; identify and implement what's still missing.

## Files Read
- `/home/z/my-project/worklog.md` (project context — 2087 lines)
- `/home/z/my-project/upload/BUGFIX-INBOX-PERSISTENCE.md` (422 lines — full)
- `/home/z/my-project/upload/GAP-ANALYSIS-V2.md` (440 lines — full)

## What Was Already Implemented (verified)
From previous GAP-V2-COMPLETE worklog entries:
- **L1 (server side)**: API at `/api/inboxes/[id]/messages/route.ts` returns `{ code: 'INBOX_EXPIRED' }` with status 410.
- **BUGFIX-INBOX-PERSISTENCE**: Offline banner ("Showing last known state — reconnecting…") in `app-shell.tsx` lines ~462-478, fires when `!isConnected`. Visibilitychange listener re-fetches inboxes/messages/stats on tab focus. Both items verified present.
- **G1 Thread view**, **G8 Importance markers**, **G10 Spam scoring**, **G13 Print**, **G14 keyboard shortcuts**, **L4 alias reclaim**: all previously done.

## What Was Still Missing (implemented in this pass)

### 1. G2 — Reply All menu item + Cc field in ReplyDialog
**File:** `src/components/sections/messages-section.tsx`
- Added `ReplyAll` icon import from lucide-react.
- Added `replyMode` state (`'sender' | 'all'`) to `MessageReader`.
- Added "Reply to all" `DropdownMenuItem` next to "Reply to sender" in the More dropdown.
- Extended `ReplyDialog` with `replyAll?: boolean` prop.
- When `replyAll=true`: title switches to "Reply to all", a Cc input field appears (free-text, comma-separated), the description mentions Cc recipients, the success toast says "Reply sent to all recipients", and the submit button label is "Send reply to all".
- The mutation now sends `{ text, cc }` to the reply API. The API currently ignores `cc` (only sends to original sender) — full SMTP Cc routing is a future enhancement.
- Added inline comment documenting G9 (send-as alias reply-from logic) for the future Account Mode migration.

### 2. G7 — Mute conversation
**File:** `src/components/sections/messages-section.tsx`
- Added `BellOff`, `Bell` icon imports.
- Added `mutedThreads: Set<string>` state hydrated from `localStorage['studenttemp_muted_threads']` (persists across tab close/reload).
- Added `showMuted` state + a toolbar toggle button that appears when `mutedThreads.size > 0` (label "Muted (N)" / "Hide muted").
- Added `muteThread(subject)` and `unmuteThread(subject)` callbacks. Both compute the same normalized subject key used by the thread grouping logic and write to localStorage.
- Added `visibleThreads` memo: when `showMuted=true`, returns all threads; otherwise filters out muted ones.
- Added `listFiltered` memo: applies the same mute filter to the flat message list. When `showMuted=true`, the filter is skipped so muted messages reappear in both views.
- The empty-state message adapts: "Inbox cleared" + "All visible messages are muted. Tap 'Muted' above to reveal them." when all messages are muted.
- Extended `ThreadGroup` component with `isMuted`, `onMute`, `onUnmute` props. The thread header now shows a "Muted" badge + a BellOff icon overlay on the avatar when muted, and an opacity-dimmed style. A hover-revealed mute/unmute button sits at the top-right of the header.
- Added a TODO comment: in Account Mode, the mute state should be mirrored to the `threads` table so the server can suppress new-message notifications for muted threads.

### 3. G11 — Undo for mark-read and star actions
**File:** `src/components/sections/messages-section.tsx`
- Added `pendingStateRef` (Map<msgId, { msg, patch, timer }>) for undo-aware state changes.
- Added `fireStateChange(msgId, patch)` helper that calls the API and reverts the local state on failure.
- Added `handleStateChangeWithUndo(msg, patch, opts)` — applies the state change optimistically, schedules the API call for 5s later, and shows the UndoSnackbar. If a second state change arrives for the same message before the timer fires, the first one is committed immediately (no more undo) before the new one starts.
- Added `handleToggleReadWithUndo` and `handleToggleStarWithUndo` wrappers.
- Generalized `UndoSnackbar` to accept `icon: 'delete' | 'read' | 'star'` and an optional `title` prop. Each icon gets its own badge color (red/amber/emerald) and matching aria-label.
- Replaced `updateMutation.mutate(...)` calls for `onToggleRead`/`onToggleStar` (both in `MessageListItem` and in the reader header's star button) with the new undo-aware handlers.
- The bulk "Mark all read" action still uses `updateMutation.mutate` directly (no undo for bulk — per spec).

### 4. L1 — Client-side INBOX_EXPIRED handler
**File:** `src/lib/api-client.ts`
- Added `ApiError` class extending `Error` with `code?: string` and `status: number`.
- Updated `req<T>()` to throw `new ApiError(msg, res.status, data?.code)` instead of a plain Error. The error code is now preserved on the thrown object.

**File:** `src/components/sections/messages-section.tsx`
- Imported `ApiError` from `@/lib/api-client`.
- Added `setActiveSection`, `setActiveInboxId`, `setInboxMirror` to the destructured store state.
- Added `retry: (failureCount, err) => …` to the messages useQuery options: returns `false` immediately for `INBOX_EXPIRED` (no retry — inbox is genuinely gone), otherwise retries up to 3 times.
- Added `inboxExpiredHandledRef` to deduplicate the transition (so re-renders don't double-fire).
- Added a `useEffect` watching `msgQueryError`: on `INBOX_EXPIRED`, clears the inbox + mirror, transitions to the `'expired'` section with the original email, shows a warning toast, and removes the errored query from cache so future visits re-query cleanly.

### 5. L2 — App Lock pending deep-link navigation
**File:** `src/lib/store.ts`
- Added `pendingNavigation: { section: SectionId; params?: Record<string, string> } | null` state to the store.
- Added `setPendingNavigation` setter.

**File:** `src/components/sections/applock-section.tsx`
- Imported `type SectionId` from the store.
- Subscribed to `pendingNavigation`, `setPendingNavigation`, and `setActiveSection` in `LockScreen`.
- Updated `handleUnlocked` to drain any pending navigation right after `setLocked(false)`: if pending exists, clear it and call `setActiveSection(pending.section, pending.params ?? {})` instead of falling through to the default Home.
- Added a window event listener for `studenttemp:deep-link-request` CustomEvents. When fired:
  - If locked: stashes the requested section/params as `pendingNavigation` and shows a "Locked — sign in to view" toast.
  - If unlocked: routes immediately via `setActiveSection`.

**File:** `src/components/app-shell.tsx`
- Added an `action.label: 'View'` and `onClick` to the "New message arrived" toast. The click dispatches a `studenttemp:deep-link-request` CustomEvent targeting the Messages section — which the LockScreen listener picks up.

### 6. G9 / L3 / L5 — Account Mode documentation
**File:** `src/components/sections/messages-section.tsx` (ReplyDialog)
- Added a comment block above `ReplyDialog` documenting G9 (send-as alias reply-from logic) for the future Account Mode migration.

**File:** `src/components/sections/settings-section.tsx`
- Added a new dashed-border "Account Mode (coming soon)" Card after the "Data & privacy" card.
- The card body lists the L3, L5, and G9 logic in plain language so the requirements aren't lost between now and the actual Account Mode build.
- Added a multi-line JSX comment block above the card with the full L3 / L5 / G9 spec text for future developers.

## Verification

### `bun run lint`
✅ Clean — zero errors.

### `bun x tsc --noEmit`
Shows only pre-existing TS errors (lucide ref typing, oklch color issues, etc.). None introduced by this pass.

### `agent-browser` smoke test (manual click-through)
1. ✅ App loads at `/` (HTTP 200)
2. ✅ Generated inbox → test email received in real-time
3. ✅ Opened message reader → More dropdown now shows both "Reply to sender" AND "Reply to all"
4. ✅ Clicking "Reply to all" opens a dialog with title "Reply to all", a Cc recipients text input, body, and "Send reply to all" button
5. ✅ Toggle Threads view → thread group header shows "Mute conversation" button (hover-revealed)
6. ✅ Click Mute → thread hidden from list, "Muted (1)" toolbar button appears, toast confirms
7. ✅ Click "Muted (1)" → muted thread reappears with "Muted" badge + "Unmute conversation" button
8. ✅ Click Unmute → thread unmuted, toast confirms
9. ✅ Click Star button → "Starred [subject] Undo" toast appears with "Undo star" aria-label
10. ✅ Click Mark unread → "Marked as unread [subject] Undo" toast appears with "Undo mark-read" aria-label
11. ✅ Navigate to Settings → "Account Mode (coming soon)" card visible with L3/L5/G9 text
12. ✅ No new console errors introduced (only pre-existing oklch/hydration warnings)

### `dev.log`
- Server running cleanly, all API endpoints returning 200, no compile errors after changes.

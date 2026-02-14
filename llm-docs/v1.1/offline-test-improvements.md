# Offline Feature: Test Gaps [RESOLVED]

All three gaps below have been addressed. Tests added in `src/routes/api/sync/server.test.ts` and `src/lib/offline/sync.test.ts`. The `isSyncing` crash bug (section 3) was also fixed with a try/finally wrapper in `src/lib/offline/sync.ts`.

---

*Original problem statements preserved below for reference.*

Three areas of the Phase 10 offline implementation had no automated test coverage. Each section describes what was untested and why it matters.

---

## 1. Sync Endpoint Input Validation

**File**: `src/routes/api/sync/+server.ts`

The `/api/sync` POST endpoint accepts an `action` string and a `payload` object from the client. It validates the action type (returns 400 for unknown actions) but performs no validation on payload fields before passing them to database query functions.

The form actions in `src/routes/workout/[sessionId]/+page.server.ts` validate all inputs properly (`isNaN` checks, string trimming, type coercion). The sync endpoint bypasses these form actions entirely and calls the same query functions directly, without replicating any of that validation.

Specific gaps:

- `payload.setLogId`, `payload.exerciseLogId`, `payload.sessionId`, `payload.exerciseId` are passed to query functions without checking they are positive integers. Values like `NaN`, `undefined`, negative numbers, or strings would reach the database layer.
- `payload.weight` is not checked for `NaN`, `Infinity`, or negative values. The form action coerces empty strings to `null` and casts to `Number`; the sync endpoint does some of this for `UPDATE_SET` but not consistently.
- `payload.unit` is not validated to be exactly `'kg'` or `'lbs'`. Any string value would be written to the database.
- `payload.exerciseName` in `ADD_ADHOC` is passed directly to `addAdhocExercise()` without trimming or length checking. The form action trims and rejects empty strings; the sync endpoint does not.
- Missing required fields (e.g., `ADD_ADHOC` without `sessionId`) would cause the query function to receive `undefined`, leading to unpredictable behaviour.

Tests should send malformed payloads through the endpoint and verify they are rejected with appropriate error responses rather than silently corrupting data.

---

## 2. Queue Retry and Overflow Behaviour

**Files**: `src/lib/offline/queue.ts`, `src/lib/offline/sync.ts`

The offline queue has a `retryCount` field that is incremented each time an action fails to sync, but no code ever checks this value against a maximum. Actions that permanently fail (e.g., referencing a deleted session or exercise log) will be retried every 30 seconds indefinitely. This creates two problems:

- **Infinite retry loop**: A single permanently-failing action generates a failed HTTP request every 30 seconds for as long as the app is open. Over a gym session this could be hundreds of wasted requests. The action is never discarded and never succeeds.
- **Queue poisoning**: Because `syncQueue()` processes actions sequentially and continues past failures, a permanently-failing action stays in the queue while new actions are added behind it. The queue grows monotonically. There is no size limit on the IndexedDB object store, so this growth is unbounded.

The sync engine also does not distinguish between transient errors (network timeout, server temporarily unavailable) and permanent errors (400 response indicating invalid data, 404 for a deleted resource). Both cases increment `retryCount` identically. A 400 response means the action will never succeed regardless of how many times it is retried.

Tests should verify:
- What happens when an action fails N consecutive times (is it eventually discarded or quarantined?).
- What happens when the queue contains hundreds or thousands of entries (does sync performance degrade?).
- Whether 4xx responses are treated differently from network failures.

---

## 3. Sync Engine Concurrency and Partial Failure

**File**: `src/lib/offline/sync.ts`

The sync engine has a guard (`if (offlineState.isSyncing) return`) to prevent concurrent sync runs. It processes the queue sequentially, removing each action from IndexedDB after a successful server response. Several edge cases in this flow are untested:

- **Partial sync failure**: If a batch of 10 queued actions is being synced and action 5 fails (server error or network drop mid-sync), actions 1-4 have been removed from the queue and action 5 has had its retry count incremented. Actions 6-10 are also attempted. If the failure was a network drop, actions 6-10 will also fail and all get retry increments. But if the failure was specific to action 5's data, actions 6-10 may succeed. The queue ends up with only the failing action remaining. This is arguably correct behaviour, but it is unverified.
- **Concurrent trigger suppression**: Both the 30-second interval and the `online` event listener call `syncQueue()`. If the browser fires the `online` event at the same moment the periodic timer fires, the `isSyncing` guard should prevent a double-run. However, the second call returns immediately without rescheduling, so those queued actions are not retried until the next 30-second tick or the next `online` event. This is minor but unverified.
- **Actions added during sync**: If the user logs a set while a sync is in progress, the new action is added to IndexedDB after `getQueuedActions()` has already captured its snapshot. The new action will not be processed until the next sync cycle. This is likely correct, but should be verified.
- **`isSyncing` flag not cleared on crash**: If `syncQueue()` throws an unhandled exception (e.g., IndexedDB read fails), `offlineState.isSyncing` remains `true` and all future sync attempts are silently skipped. The `for` loop's `try/catch` only covers individual action processing, not the `getQueuedActions()` call or the `updatePendingCount()` calls outside the loop.

Tests should verify the sync engine's behaviour under each of these scenarios, particularly the `isSyncing` flag lifecycle and whether it is always correctly reset.

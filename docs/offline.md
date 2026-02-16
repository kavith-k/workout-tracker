# Offline Support

The app is a PWA with offline write support. When the server is unreachable, workout actions are queued locally and synced when connectivity returns.

## Service Worker

Configured via `@vite-pwa/sveltekit` with Workbox `generateSW` strategy and `autoUpdate` registration.

- All static assets (`*.{js,css,html,ico,png,svg,woff2}`) are precached
- Navigate fallback to `/` serves the SPA shell for offline navigation
- Disabled in dev mode

## Module Structure

```
src/lib/offline/
  queue.ts            # IndexedDB queue for pending write actions
  stores.svelte.ts    # Reactive state (online status, sync status, pending count)
  sync.ts             # Sync engine (periodic + on-reconnect)
```

## IndexedDB Queue

Database `workout-tracker-offline` (version 1) with object store `sync-queue`.

Each queued action contains:

| Field       | Description                              |
| ----------- | ---------------------------------------- |
| id          | `crypto.randomUUID()` identifier         |
| timestamp   | `Date.now()` when queued                 |
| action      | Action type (see below)                  |
| payload     | Action-specific data (set IDs, weights, etc.) |
| retryCount  | Starts at 0, incremented on each failure |

Actions are dropped after 10 failed retries.

### Action Types

| Action             | Description                          |
| ------------------ | ------------------------------------ |
| `SAVE_EXERCISE`    | Save set weight/reps/unit            |
| `COMPLETE_WORKOUT` | Complete or cancel session (see below) |
| `ADD_ADHOC`        | Add an ad-hoc exercise to a session  |
| `ADD_SET`          | Add a set to an exercise log         |
| `REMOVE_SET`       | Remove a set from an exercise log    |

## Sync Engine

- **On reconnect**: Immediately processes the queue via `online` event listener
- **Periodic**: Runs every 30 seconds via `setInterval`
- **Sequential**: Actions are processed one at a time in timestamp order
- **Endpoint**: Each action is sent as `POST /api/sync` with `{ action, payload }`
- **Success**: Action removed from queue
- **Failure**: Retry count incremented; dropped after 10 retries

The `/api/sync` endpoint dispatches to existing server-side query functions (e.g., `updateSetLog`, `completeWorkout`, `addAdhocExercise`).

### Empty Workout Cancellation

When `COMPLETE_WORKOUT` is processed (online or via sync), `completeWorkout()` checks whether any exercise has logged reps. If no reps were logged for any exercise, the session, exercise logs, and set logs are deleted and the response includes `{ cancelled: true }`. The client redirects to home instead of the summary page.

## Reactive State

`stores.svelte.ts` exports a singleton `offlineState` using Svelte 5 `$state` runes:

- `isOnline` -- tracks `navigator.onLine` plus event listeners
- `pendingSyncCount` -- number of queued actions
- `isSyncing` -- guard against re-entrant sync

## Offline Form Handling

Workout logging forms use `use:enhance` with an offline fallback pattern:

```svelte
use:enhance={() => {
  return async ({ result }) => {
    if (result.type === 'error') {
      // Network failure - queue for later sync
      await addToQueue('ACTION_TYPE', { ... });
    }
  };
}}
```

## UI Indicator

`OfflineIndicator.svelte` (mounted in `AppShell`) shows a fixed pill at bottom-right:

- **Offline**: "Offline" when `!isOnline`
- **Syncing**: "Syncing N..." when online with pending actions
- **Hidden**: When fully connected with no pending actions

## HTTPS Requirement

Service workers require HTTPS (except on `localhost`). For remote access, use a reverse proxy to terminate TLS. See [deployment docs](deployment.md).

## Initialisation

The root layout (`+layout.svelte`) calls `initOfflineListeners()` and `setupSyncListeners()` on mount. Both return cleanup functions invoked on unmount.

# Architecture

## Tech Stack

| Layer     | Technology                            |
| --------- | ------------------------------------- |
| Framework | SvelteKit 2 (Svelte 5), Node adapter |
| Styling   | TailwindCSS v4 + shadcn-svelte       |
| Database  | SQLite via better-sqlite3 + Drizzle ORM |
| Offline   | PWA with Service Worker (Workbox)     |
| Testing   | Vitest (unit/component) + Playwright (E2E) |

## Directory Structure

```
src/
  lib/
    server/
      db/
        index.ts          # DB connection (auto-detected path)
        schema.ts          # Drizzle schema definition
        queries/           # Reusable query functions
          programs.ts      # Programme CRUD
          exercises.ts     # Exercise CRUD
          workouts.ts      # Workout session lifecycle
          history.ts       # History browsing and deletion
          export.ts        # JSON/CSV export assembly
      utils/               # Server-side utilities
    components/
      ui/                  # shadcn-svelte components
      layout/              # App shell, navigation, resume banner
      program/             # Programme form
      workout/             # Workout wizard components
      shared/              # Offline indicator, empty state, confirm dialog
    offline/
      queue.ts             # IndexedDB queue management
      sync.ts              # Sync engine (periodic + on-reconnect)
      stores.svelte.ts     # Reactive online/sync status
    utils.ts               # cn() helper, shadcn type helpers
  routes/                  # SvelteKit file-based routing (see below)
  app.html
  app.css                  # Tailwind imports, global styles
static/                    # PWA icons, favicon
drizzle/                   # Generated migrations
e2e/                       # Playwright E2E tests
```

## Routes

| Route                          | Purpose                                       |
| ------------------------------ | --------------------------------------------- |
| `/`                            | Home screen with active programme days         |
| `/workout/start`               | Form action to create session and redirect     |
| `/workout/[sessionId]`         | Active workout logging interface               |
| `/workout/[sessionId]/summary` | Post-workout summary with PRs and stats        |
| `/history`                     | Past workouts by date (default view)           |
| `/history/by-exercise`         | History grouped by exercise                    |
| `/history/[sessionId]`         | Single workout session details                 |
| `/programs`                    | List and manage programmes                     |
| `/programs/new`                | Create new programme                           |
| `/programs/[programId]`        | Edit existing programme                        |
| `/exercises`                   | Exercise library with stats                    |
| `/settings`                    | Data export (JSON/CSV)                         |
| `/api/sync`                    | POST endpoint for offline queue synchronisation |

## Data Flow

### Starting a Workout

1. User taps a workout day on the home screen
2. `POST /workout/start` creates a `workout_session` (status: `in_progress`), pre-creates `exercise_logs` and empty `set_logs`
3. Redirects to `/workout/[sessionId]`
4. Load function fetches session details, exercise logs with sets, and progressive overload data

### Logging Sets

Each set row is a `<form action="?/updateSet">` with `use:enhance`. Weight and reps inputs fire `requestSubmit()` on change for immediate server-side persistence. The enhance callback skips `update()` to avoid re-rendering during active editing.

If the server is unreachable, the action is queued to IndexedDB for later sync (see [offline docs](offline.md)).

### Completing a Workout

1. User taps "Stop" and confirms
2. Session marked as `completed`, unlogged exercises auto-marked as `skipped`
3. Redirects to summary page showing completion stats and any PRs

### Stale Workout Cleanup

The root layout server load calls `closeStaleWorkouts()` on every page load. Any `in_progress` session older than 4 hours is auto-completed with unlogged exercises marked as `skipped`. This prevents abandoned workouts from blocking new ones.

## Key Design Decisions

| Decision                    | Rationale                                                     |
| --------------------------- | ------------------------------------------------------------- |
| Drizzle ORM                 | Type-safe, lightweight, good SQLite support                   |
| SvelteKit form actions      | Progressive enhancement, works with PWA offline fallback      |
| Snapshot fields in logs     | Preserves historical accuracy when entities are renamed/deleted |
| Per-set immediate save      | Maximum data safety, survives crashes/closes                  |
| Single active programme     | Simplifies home screen and workout start flow                 |
| IndexedDB for offline queue | Browser-native, reliable, works with service workers          |

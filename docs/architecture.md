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
      home/                # ConsistencyGrid (GitHub-style activity heatmap)
      program/             # Programme form (drag-to-reorder via svelte-dnd-action)
      workout/             # Workout wizard, ExerciseStep (set logging, copy-down, volume)
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
scripts/
  seed-test-data.mjs       # Wipe DB and populate with 2 years of sample data
```

## Routes

| Route                          | Purpose                                       |
| ------------------------------ | --------------------------------------------- |
| `/`                            | Home screen with active programme days and consistency grid |
| `/workout/start`               | Form action to create session and redirect     |
| `/workout/[sessionId]`         | Active workout logging interface               |
| `/workout/[sessionId]/summary` | Post-workout summary with PRs and stats        |
| `/history`                     | Past workouts by date with infinite scroll     |
| `/history/[sessionId]`         | Single workout session details                 |
| `/api/history`                 | GET endpoint for paginated history (infinite scroll) |
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

A **copy-down** button (arrow icon) appears on empty sets, copying weight and reps from the previous set. Live **volume** (weight x reps summed) is shown per exercise alongside the previous session's volume.

### Completing a Workout

1. User taps "Stop" and confirms
2. Unlogged exercises are auto-marked as `skipped`
3. If **no exercises** have any logged reps, the workout is cancelled: all logs and the session are deleted, and the user is redirected home with a cancellation message
4. Otherwise, session marked as `completed` and redirected to summary page with PRs and stats

### Programme Editing

Days and exercises within the programme form are reordered via **drag-and-drop** (using `svelte-dnd-action` with drag handles). Touch-friendly with flip animations.

### Stale Workout Cleanup

The root layout server load calls `closeStaleWorkouts()` on every page load. Any `in_progress` session older than 4 hours is auto-completed with unlogged exercises marked as `skipped`. This prevents abandoned workouts from blocking new ones.

## Test Data

To populate the database with realistic sample data for development or testing:

```bash
node scripts/seed-test-data.mjs
```

This deletes the existing database, runs migrations to recreate the schema, then seeds ~240 completed workout sessions spanning 2 years (Feb 2024 -- Feb 2026) with progressive overload, sporadic scheduling, and occasional skipped exercises.

## Key Design Decisions

| Decision                    | Rationale                                                     |
| --------------------------- | ------------------------------------------------------------- |
| Drizzle ORM                 | Type-safe, lightweight, good SQLite support                   |
| SvelteKit form actions      | Progressive enhancement, works with PWA offline fallback      |
| Snapshot fields in logs     | Preserves historical accuracy when entities are renamed/deleted |
| Per-set immediate save      | Maximum data safety, survives crashes/closes                  |
| Single active programme     | Simplifies home screen and workout start flow                 |
| IndexedDB for offline queue | Browser-native, reliable, works with service workers          |
| svelte-dnd-action           | Touch-friendly drag-and-drop with Svelte integration          |
| Empty workout cancellation  | Prevents clutter from accidental/empty workout sessions       |

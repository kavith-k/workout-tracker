# Workout Tracker - Technical Design

## Overview

This document outlines the technical architecture for the Workout Tracker application. It should be read alongside `REQUIREMENTS.md` which contains the product requirements and user stories.

---

## Tech Stack

| Layer     | Technology                  |
| --------- | --------------------------- |
| Framework | SvelteKit 2 (Svelte 5)      |
| Styling   | TailwindCSS + shadcn-svelte |
| Database  | SQLite                      |
| ORM       | Drizzle ORM                 |
| Runtime   | Node.js (Docker container)  |
| Offline   | PWA with Service Worker     |

---

## Database

### Configuration

- **Required**: `DATABASE_PATH` environment variable must be set
- **Development**: Use `.env` file with `DATABASE_PATH=./data/workout-tracker.db`
- **Production**: Docker container mounts a volume and sets `DATABASE_PATH` to the mounted path
- The `.env` file and `data/` directory are gitignored

### Schema

```
┌─────────────────┐       ┌─────────────────────┐
│    programs     │       │    workout_days     │
├─────────────────┤       ├─────────────────────┤
│ id (PK)         │──┐    │ id (PK)             │
│ name            │  │    │ program_id (FK)     │──┐
│ is_active       │  └───<│ name                │  │
│ created_at      │       │ sort_order          │  │
│ updated_at      │       │ created_at          │  │
└─────────────────┘       └─────────────────────┘  │
                                                   │
┌─────────────────┐       ┌─────────────────────┐  │
│   exercises     │       │   day_exercises     │  │
├─────────────────┤       ├─────────────────────┤  │
│ id (PK)         │──┐    │ id (PK)             │  │
│ name            │  │    │ workout_day_id (FK) │<─┘
│ unit_preference │  └───<│ exercise_id (FK)    │
│ created_at      │       │ sets_count          │
└─────────────────┘       │ sort_order          │
        │                 │ created_at          │
        │                 └─────────────────────┘
        │
        │         ┌─────────────────────┐
        │         │  workout_sessions   │
        │         ├─────────────────────┤
        │         │ id (PK)             │
        │         │ program_id (FK)     │──> (nullable, for reference)
        │         │ workout_day_id (FK) │──> (nullable, for reference)
        │         │ program_name        │    (snapshot at time of workout)
        │         │ day_name            │    (snapshot at time of workout)
        │         │ status              │    ('in_progress' | 'completed')
        │         │ started_at          │
        │         │ completed_at        │
        │         └─────────────────────┘
        │                   │
        │                   ▼
        │         ┌─────────────────────┐
        │         │   exercise_logs     │
        │         ├─────────────────────┤
        │         │ id (PK)             │
        └────────>│ exercise_id (FK)    │
                  │ session_id (FK)     │
                  │ exercise_name       │    (snapshot at time of workout)
                  │ status              │    ('logged' | 'skipped')
                  │ is_adhoc            │
                  │ sort_order          │
                  │ created_at          │
                  └─────────────────────┘
                            │
                            ▼
                  ┌─────────────────────┐
                  │     set_logs        │
                  ├─────────────────────┤
                  │ id (PK)             │
                  │ exercise_log_id(FK) │
                  │ set_number          │
                  │ weight              │    (nullable - 0 if not performed)
                  │ reps                │    (nullable - 0 if not performed)
                  │ unit                │    ('kg' | 'lbs')
                  │ created_at          │
                  └─────────────────────┘
```

### Drizzle Schema Definition

```typescript
// src/lib/server/db/schema.ts

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const programs = sqliteTable('programs', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const workoutDays = sqliteTable('workout_days', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	programId: integer('program_id')
		.notNull()
		.references(() => programs.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	sortOrder: integer('sort_order').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const exercises = sqliteTable('exercises', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	unitPreference: text('unit_preference', { enum: ['kg', 'lbs'] })
		.notNull()
		.default('kg'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const dayExercises = sqliteTable('day_exercises', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	workoutDayId: integer('workout_day_id')
		.notNull()
		.references(() => workoutDays.id, { onDelete: 'cascade' }),
	exerciseId: integer('exercise_id')
		.notNull()
		.references(() => exercises.id),
	setsCount: integer('sets_count').notNull().default(3),
	sortOrder: integer('sort_order').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const workoutSessions = sqliteTable('workout_sessions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	programId: integer('program_id').references(() => programs.id, { onDelete: 'set null' }),
	workoutDayId: integer('workout_day_id').references(() => workoutDays.id, {
		onDelete: 'set null'
	}),
	programName: text('program_name').notNull(),
	dayName: text('day_name').notNull(),
	status: text('status', { enum: ['in_progress', 'completed'] })
		.notNull()
		.default('in_progress'),
	startedAt: integer('started_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	completedAt: integer('completed_at', { mode: 'timestamp' })
});

export const exerciseLogs = sqliteTable('exercise_logs', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	exerciseId: integer('exercise_id').references(() => exercises.id, { onDelete: 'set null' }),
	sessionId: integer('session_id')
		.notNull()
		.references(() => workoutSessions.id, { onDelete: 'cascade' }),
	exerciseName: text('exercise_name').notNull(),
	status: text('status', { enum: ['logged', 'skipped'] })
		.notNull()
		.default('logged'),
	isAdhoc: integer('is_adhoc', { mode: 'boolean' }).notNull().default(false),
	sortOrder: integer('sort_order').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const setLogs = sqliteTable('set_logs', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	exerciseLogId: integer('exercise_log_id')
		.notNull()
		.references(() => exerciseLogs.id, { onDelete: 'cascade' }),
	setNumber: integer('set_number').notNull(),
	weight: real('weight'),
	reps: integer('reps'),
	unit: text('unit', { enum: ['kg', 'lbs'] })
		.notNull()
		.default('kg'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});
```

### Key Schema Decisions

1. **Snapshot fields**: `program_name`, `day_name`, `exercise_name` are stored as snapshots at workout time. This ensures historical logs remain accurate even if the source is renamed or deleted.

2. **Nullable foreign keys**: `program_id`, `workout_day_id`, `exercise_id` can become null if the referenced entity is deleted, but the snapshot fields preserve the data.

3. **Sort order**: Both `workout_days` and `day_exercises` have `sort_order` for maintaining user-defined ordering.

4. **Unit preference**: Stored per-exercise in the `exercises` table, and per-set in `set_logs` (in case of mixed units in history).

5. **Status tracking**: `workout_sessions` has status to track in-progress vs completed workouts. `exercise_logs` has status to track logged vs skipped exercises.

---

## SvelteKit Routes

```
src/routes/
├── +layout.svelte              # Root layout with hamburger menu
├── +layout.server.ts           # Load active program, in-progress workout
├── +page.svelte                # Home: workout day buttons
├── +page.server.ts             # Load active program days
│
├── workout/
│   ├── [sessionId]/
│   │   ├── +page.svelte        # Workout logging screen
│   │   ├── +page.server.ts     # Load session, exercises, sets
│   │   └── +server.ts          # API for set updates (for offline sync)
│   └── start/
│       └── +server.ts          # POST to start a workout session
│
├── history/
│   ├── +page.svelte            # History list (by date, default)
│   ├── +page.server.ts         # Load sessions with logs
│   ├── by-exercise/
│   │   ├── +page.svelte        # History by exercise view
│   │   └── +page.server.ts     # Load exercises with history
│   └── [sessionId]/
│       ├── +page.svelte        # Single session detail
│       └── +page.server.ts     # Load session detail
│
├── programs/
│   ├── +page.svelte            # Programs list (actions: setActive, delete, duplicate)
│   ├── +page.server.ts         # Load all programs, form actions
│   ├── new/
│   │   ├── +page.svelte        # Create program form
│   │   └── +page.server.ts     # Form action for create
│   └── [programId]/
│       ├── +page.svelte        # Edit program form
│       └── +page.server.ts     # Load program, form action for update
│
├── exercises/
│   ├── +page.svelte            # Exercise library list
│   ├── +page.server.ts         # Load exercises with stats
│   └── [exerciseId]/
│       └── +page.server.ts     # Form actions for update/delete
│
├── settings/
│   ├── +page.svelte            # Settings page
│   └── export/
│       ├── json/
│       │   └── +server.ts      # GET to download JSON export
│       └── csv/
│           └── +server.ts      # GET to download CSV export
│
└── api/
    └── sync/
        └── +server.ts          # POST endpoint for offline sync queue
```

### Route Responsibilities

| Route                   | Purpose                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `/`                     | Home screen with active program days, resume workout banner |
| `/workout/[sessionId]`  | Active workout logging interface                            |
| `/workout/start`        | API to create new workout session                           |
| `/history`              | View past workouts by date                                  |
| `/history/by-exercise`  | View history grouped by exercise                            |
| `/history/[sessionId]`  | View single workout session details                         |
| `/programs`             | List and manage programs                                    |
| `/programs/new`         | Create new program                                          |
| `/programs/[programId]` | Edit existing program                                       |
| `/exercises`            | View and manage exercise library                            |
| `/settings`             | App settings, export functionality                          |
| `/api/sync`             | Endpoint for offline queue synchronization                  |

---

## Component Architecture

### Layout Components

```
src/lib/components/
├── layout/
│   ├── AppShell.svelte         # Main app wrapper
│   ├── HamburgerMenu.svelte    # Navigation sheet (uses shadcn Sheet)
│   ├── NavLink.svelte          # Individual nav item
│   └── ResumeWorkoutBanner.svelte  # "Workout in progress" toast/banner
```

### Workout Components

```
├── workout/
│   ├── ExerciseSelector.svelte # Dropdown to switch exercises
│   ├── ExerciseCard.svelte     # Card showing exercise with all sets
│   ├── SetRow.svelte           # Single set input row (weight, reps)
│   ├── ProgressiveHints.svelte # Previous/max data display
│   ├── AddAdhocExercise.svelte # Dialog to add ad-hoc exercise
│   ├── StopWorkoutDialog.svelte # Confirmation dialog
│   └── WorkoutSummary.svelte   # Post-workout summary screen
```

### Program Components

```
├── program/
│   └── ProgramForm.svelte      # Shared create/edit form with dynamic days,
│                                # exercises, reordering, validation, and
│                                # datalist autocomplete for exercise names
```

Note: The program list page (`/programs/+page.svelte`) handles program cards, dropdown actions, delete confirmation (AlertDialog), and duplicate dialog inline rather than as separate components.

### History Components

```
├── history/
│   ├── SessionCard.svelte      # Workout session summary card
│   ├── ExerciseLogCard.svelte  # Exercise within a session
│   ├── SetLogRow.svelte        # Display of a logged set
│   └── ViewToggle.svelte       # Toggle between date/exercise view
```

### Exercise Library Components

```
├── exercises/
│   ├── ExerciseListItem.svelte # Exercise with stats
│   ├── ExerciseStats.svelte    # Max weight, last performed
│   └── EditExerciseDialog.svelte # Rename/delete dialog
```

### Shared/UI Components

```
├── ui/                         # shadcn-svelte components
│   ├── alert-dialog/
│   ├── badge/
│   ├── button/
│   ├── card/
│   ├── command/
│   ├── dialog/
│   ├── dropdown-menu/
│   ├── input/
│   ├── label/
│   ├── popover/
│   ├── separator/
│   ├── sheet/
│   └── toast/
│
├── shared/
│   ├── OfflineIndicator.svelte # Shows offline status + pending sync count
│   ├── EmptyState.svelte       # Generic empty state display
│   ├── ConfirmDialog.svelte    # Reusable confirmation dialog
│   └── LoadingSpinner.svelte   # Loading indicator
```

---

## Data Flow

### Starting a Workout

```
User taps workout day on Home
         │
         ▼
POST /workout/start
  - body: { workoutDayId }
         │
         ▼
Server:
  1. Check no in-progress workout exists
  2. Create workout_session (status: 'in_progress')
  3. Create exercise_logs for each day_exercise
  4. Create empty set_logs for each exercise (based on sets_count)
  5. Return sessionId
         │
         ▼
Redirect to /workout/[sessionId]
         │
         ▼
Load function fetches:
  - Session details
  - All exercise_logs with set_logs
  - Progressive overload data for each exercise
         │
         ▼
Render workout logging UI
```

### Logging a Set

```
User fills in weight/reps for a set
         │
         ▼
On blur/change, form action triggers
  - Immediate save to database
  - If offline: save to IndexedDB queue instead
         │
         ▼
Server updates set_logs row
  - Also updates exercise.unit_preference if unit changed
         │
         ▼
UI shows saved state (or "pending sync" if offline)
```

### Stopping a Workout

```
User taps "Stop" button
         │
         ▼
Confirmation dialog appears
         │
         ▼
User confirms
         │
         ▼
Form action:
  1. Update workout_session.status = 'completed'
  2. Update workout_session.completed_at = now
  3. Mark any unlogged exercises as 'skipped'
         │
         ▼
Redirect to summary page
  - Show exercises completed vs planned
  - Show any PRs hit (compare to previous max)
  - Show congratulations if all completed
         │
         ▼
User taps "Done" → redirect to Home
```

### Progressive Overload Query

```sql
-- For a given exercise_id, get previous and max

-- Previous (last logged, not skipped)
SELECT sl.weight, sl.reps, sl.unit, ws.started_at
FROM set_logs sl
JOIN exercise_logs el ON sl.exercise_log_id = el.id
JOIN workout_sessions ws ON el.session_id = ws.id
WHERE el.exercise_id = ?
  AND el.status = 'logged'
  AND sl.weight IS NOT NULL
  AND ws.status = 'completed'
ORDER BY ws.started_at DESC, sl.set_number ASC
LIMIT 1;

-- Max (heaviest weight ever)
SELECT sl.weight, sl.reps, sl.unit, ws.started_at
FROM set_logs sl
JOIN exercise_logs el ON sl.exercise_log_id = el.id
JOIN workout_sessions ws ON el.session_id = ws.id
WHERE el.exercise_id = ?
  AND el.status = 'logged'
  AND sl.weight IS NOT NULL
  AND ws.status = 'completed'
ORDER BY sl.weight DESC
LIMIT 1;
```

---

## Offline / PWA Strategy

### Service Worker Setup

Using `vite-plugin-pwa` with SvelteKit:

```typescript
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default {
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			strategies: 'generateSW',
			registerType: 'autoUpdate',
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
				runtimeCaching: [
					{
						urlPattern: /^https?:\/\/.*\/api\/.*/,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'api-cache',
							networkTimeoutSeconds: 3
						}
					}
				]
			}
		})
	]
};
```

### Offline Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │   Svelte    │───>│  IndexedDB  │───>│ Service Worker  │  │
│  │   App       │<───│  (Queue)    │<───│ (Background)    │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│         │                                      │             │
└─────────┼──────────────────────────────────────┼─────────────┘
          │                                      │
          │ Online                               │ Sync when online
          ▼                                      ▼
    ┌───────────────────────────────────────────────┐
    │                   Server                       │
    │              /api/sync endpoint                │
    └───────────────────────────────────────────────┘
```

### IndexedDB Queue Structure

```typescript
// src/lib/offline/queue.ts

interface QueuedAction {
	id: string; // UUID
	timestamp: number; // When queued
	action: 'UPDATE_SET' | 'SKIP_EXERCISE' | 'COMPLETE_WORKOUT';
	payload: {
		setLogId?: number;
		weight?: number;
		reps?: number;
		unit?: 'kg' | 'lbs';
		exerciseLogId?: number;
		sessionId?: number;
	};
	retryCount: number;
}
```

### Sync Logic

```typescript
// Pseudo-code for sync

async function syncQueue() {
	const queue = await getQueuedActions();

	for (const action of queue) {
		try {
			await fetch('/api/sync', {
				method: 'POST',
				body: JSON.stringify(action)
			});
			await removeFromQueue(action.id);
		} catch (error) {
			// Will retry on next sync
			await incrementRetryCount(action.id);
		}
	}
}

// Trigger sync when online
window.addEventListener('online', syncQueue);

// Also try to sync periodically when app is active
setInterval(syncQueue, 30000); // Every 30 seconds
```

### Offline UI Indicator

```svelte
<!-- OfflineIndicator.svelte -->
<script>
	import { onlineStatus, pendingSyncCount } from '$lib/offline/stores';
</script>

{#if !$onlineStatus || $pendingSyncCount > 0}
	<div class="fixed right-4 bottom-4 rounded-full bg-gray-800 px-3 py-1 text-sm text-white">
		{#if !$onlineStatus}
			Offline
		{:else if $pendingSyncCount > 0}
			Syncing {$pendingSyncCount}...
		{/if}
	</div>
{/if}
```

---

## Export Functionality

### JSON Export Structure

```typescript
// /api/settings/export/json

interface ExportJSON {
	exportedAt: string; // ISO timestamp
	version: '1.0';

	programs: Array<{
		id: number;
		name: string;
		isActive: boolean;
		days: Array<{
			id: number;
			name: string;
			sortOrder: number;
			exercises: Array<{
				id: number;
				name: string;
				setsCount: number;
				sortOrder: number;
				// Progressive overload data baked in
				lastPerformed: {
					date: string;
					weight: number;
					reps: number;
					unit: 'kg' | 'lbs';
				} | null;
				maxWeight: {
					date: string;
					weight: number;
					reps: number;
					unit: 'kg' | 'lbs';
				} | null;
			}>;
		}>;
	}>;

	exercises: Array<{
		id: number;
		name: string;
		unitPreference: 'kg' | 'lbs';
	}>;
}
```

### CSV Export Structure

Single denormalized CSV with one row per set:

```csv
session_date,session_id,program_name,day_name,exercise_name,exercise_status,set_number,weight,reps,unit
2024-01-15,1,Upper Lower Split,Upper-1,Bench Press,logged,1,80,8,kg
2024-01-15,1,Upper Lower Split,Upper-1,Bench Press,logged,2,80,7,kg
2024-01-15,1,Upper Lower Split,Upper-1,Bench Press,logged,3,80,6,kg
2024-01-15,1,Upper Lower Split,Upper-1,Overhead Press,skipped,,,
```

---

## Stale Workout Handling

### Auto-Close Logic

```typescript
// In root +layout.server.ts or a scheduled job

const STALE_WORKOUT_HOURS = 4;

async function closeStaleWorkouts(db: Database) {
	const cutoff = new Date(Date.now() - STALE_WORKOUT_HOURS * 60 * 60 * 1000);

	await db
		.update(workoutSessions)
		.set({
			status: 'completed',
			completedAt: new Date()
		})
		.where(and(eq(workoutSessions.status, 'in_progress'), lt(workoutSessions.startedAt, cutoff)));
}
```

This runs on every page load to clean up stale workouts.

---

## Environment Variables

| Variable        | Required | Description                           | Example                    |
| --------------- | -------- | ------------------------------------- | -------------------------- |
| `DATABASE_PATH` | Yes      | Absolute path to SQLite database file | `/data/workout-tracker.db` |

### Development `.env`

```env
DATABASE_PATH=./data/workout-tracker.db
```

### Docker Compose Example

```yaml
version: '3.8'
services:
  workout-tracker:
    build: .
    ports:
      - '3000:3000'
    environment:
      - DATABASE_PATH=/data/workout-tracker.db
    volumes:
      - workout-data:/data

volumes:
  workout-data:
```

---

## Testing Strategy

### Approach: TDD for Logic, E2E for Flows

All business logic and data access code is developed using strict Test-Driven Development (red-green-refactor). Complete user flows are covered by E2E tests. Simple presentational components do not require isolated tests.

### Testing Stack

| Tool                    | Purpose                                                         |
| ----------------------- | --------------------------------------------------------------- |
| Vitest                  | Unit tests for server-side logic, queries, utilities            |
| @testing-library/svelte | Component tests only where components contain non-trivial logic |
| Playwright              | End-to-end tests for complete user flows                        |

### What Gets Unit Tested (TDD - Write Test First)

**Database queries** (`src/lib/server/db/queries/`):

- Program CRUD operations (create, read, update, delete, duplicate, activate/deactivate)
- Exercise CRUD operations (create, rename, delete, auto-creation)
- Workout session operations (start, complete, fetch in-progress)
- Set logging operations (create, update weight/reps)
- Progressive overload queries (previous performance, max weight)
- History queries (by date, by exercise)
- Stale workout detection and auto-close
- Export data assembly (JSON structure, CSV generation)

**Business logic and utilities** (`src/lib/utils/`, `src/lib/server/utils/`):

- Stale workout cutoff calculation
- Unit conversion (kg ↔ lbs) if applicable
- Date formatting helpers
- CSV serialization
- PR detection logic (comparing current session to historical max)
- Workout summary computation (completed vs planned, completion percentage)

**Offline sync logic** (`src/lib/offline/`):

- Queue operations (add to queue, remove from queue, get pending)
- Sync retry logic (retry count, error handling)
- Conflict resolution if any

### What Gets E2E Tested (Playwright)

Each major user flow gets at least one E2E test:

1. **Program management flow**
   - Create a program with multiple days and exercises
   - Edit a program (add/remove days, rename, reorder)
   - Duplicate a program
   - Delete a program
   - Activate/switch programs

2. **Workout logging flow**
   - Start a workout from home screen
   - Log weight and reps for sets
   - Navigate between exercises via dropdown
   - Skip an exercise
   - Add an ad-hoc exercise
   - Stop workout and see summary
   - Verify congratulatory message on full completion

3. **Progressive overload flow**
   - Log a workout
   - Start the same day again
   - Verify previous and max hints appear with correct data
   - Verify skipped exercises don't appear as "previous"

4. **History flow**
   - View history by date
   - View history by exercise
   - Verify skipped exercises show as skipped
   - Delete a workout log

5. **Exercise library flow**
   - View all exercises
   - Verify stats (max weight, last performed)
   - Rename an exercise
   - Delete an exercise (with history warning)

6. **Export flow**
   - Export JSON and verify structure
   - Export CSV and verify structure

7. **Resume workout flow**
   - Start a workout, navigate away
   - Verify resume banner appears
   - Resume and continue logging
   - Verify blocking when trying to start another workout

### Test File Structure

```
src/
├── lib/
│   ├── server/
│   │   ├── db/
│   │   │   └── queries/
│   │   │       ├── programs.ts
│   │   │       ├── programs.test.ts        # Unit tests
│   │   │       ├── exercises.ts
│   │   │       ├── exercises.test.ts       # Unit tests
│   │   │       ├── workouts.ts
│   │   │       ├── workouts.test.ts        # Unit tests
│   │   │       ├── history.ts
│   │   │       └── history.test.ts         # Unit tests
│   │   └── utils/
│   │       ├── stale-workout.ts
│   │       └── stale-workout.test.ts       # Unit tests
│   ├── utils/
│   │   ├── format.ts
│   │   ├── format.test.ts                  # Unit tests
│   │   └── ...
│   └── offline/
│       ├── queue.ts
│       ├── queue.test.ts                   # Unit tests
│       ├── sync.ts
│       └── sync.test.ts                    # Unit tests
│
e2e/
├── global-setup.ts                 # Creates fresh test DB with migrations
├── program-management.test.ts      # 8 serial tests for programs CRUD
├── workout-logging.spec.ts         # (planned)
├── progressive-overload.spec.ts    # (planned)
├── history.spec.ts                 # (planned)
├── exercise-library.spec.ts        # (planned)
├── export.spec.ts                  # (planned)
└── resume-workout.spec.ts          # (planned)
```

### Unit Test Database Strategy

Unit tests for database queries use an **in-memory SQLite database** initialized with the same Drizzle schema. Each test (or test suite) gets a fresh database instance to ensure isolation.

```typescript
// Example: src/lib/server/db/queries/programs.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../schema';
import { createProgram, getActiveProgram } from './programs';

describe('programs queries', () => {
	let db: ReturnType<typeof drizzle>;

	beforeEach(() => {
		const sqlite = new Database(':memory:');
		db = drizzle(sqlite, { schema });
		migrate(db, { migrationsFolder: './drizzle/migrations' });
	});

	it('should create a program', async () => {
		// test implementation
	});

	it('should only allow one active program', async () => {
		// test implementation
	});
});
```

### TDD Workflow Per Task

When a task involves server-side logic or utilities, the developer must:

1. **Red**: Write a failing test that describes the expected behavior
2. **Green**: Write the minimum code to make the test pass
3. **Refactor**: Clean up while keeping tests green

When a task involves a user flow, the developer must:

1. Write the Playwright E2E test describing the flow
2. Build the UI and server logic until the E2E test passes

### CI Considerations

Tests should be runnable via:

```bash
# Unit tests
npm run test:unit

# E2E tests
npm run test:e2e

# All tests
npm run test
```

---

## Key Technical Decisions Summary

| Decision                    | Rationale                                                         |
| --------------------------- | ----------------------------------------------------------------- |
| Drizzle ORM                 | Type-safe, lightweight, good SQLite support, migrations           |
| Form actions                | Progressive enhancement, simpler state management, works with PWA |
| Snapshot fields in logs     | Preserves historical accuracy when entities are renamed/deleted   |
| IndexedDB for offline queue | Browser-native, reliable, works with service workers              |
| Per-set immediate save      | Maximum data safety, survives crashes/closes                      |
| Single active program       | Simplifies home screen and workout start flow                     |
| Up/down arrows for reorder  | More reliable than drag-drop on mobile touch screens              |
| Type-ahead for exercises    | Fast input, auto-creates new exercises, familiar pattern          |

---

## File Structure

```
workout-tracker/
├── src/
│   ├── lib/
│   │   ├── server/
│   │   │   ├── db/
│   │   │   │   ├── index.ts        # DB connection
│   │   │   │   ├── schema.ts       # Drizzle schema
│   │   │   │   └── queries/        # Reusable query functions
│   │   │   │       ├── programs.ts
│   │   │   │       ├── exercises.ts
│   │   │   │       ├── workouts.ts
│   │   │   │       └── history.ts
│   │   │   └── utils/
│   │   │       └── stale-workout.ts
│   │   ├── components/
│   │   │   ├── ui/                 # shadcn components
│   │   │   ├── layout/
│   │   │   ├── workout/
│   │   │   ├── program/
│   │   │   ├── history/
│   │   │   ├── exercises/
│   │   │   └── shared/
│   │   ├── offline/
│   │   │   ├── queue.ts            # IndexedDB queue management
│   │   │   ├── sync.ts             # Sync logic
│   │   │   └── stores.ts           # Online status, pending count
│   │   └── utils/
│   │       ├── format.ts           # Date, weight formatting
│   │       └── validation.ts       # Input validation
│   ├── routes/
│   │   └── [as outlined above]
│   ├── app.html
│   ├── app.css                     # Tailwind imports, global styles
│   └── hooks.server.ts             # Request hooks if needed
├── static/
│   ├── favicon.ico
│   └── icons/                      # PWA icons
├── drizzle/
│   └── migrations/                 # Generated migrations
├── tests/
│   └── e2e/                        # Playwright E2E tests
│       ├── program-management.spec.ts
│       ├── workout-logging.spec.ts
│       ├── progressive-overload.spec.ts
│       ├── history.spec.ts
│       ├── exercise-library.spec.ts
│       ├── export.spec.ts
│       └── resume-workout.spec.ts
├── .github/
│   └── workflows/
│       ├── ci.yml                  # CI pipeline (lint, check, test, build)
│       └── cd.yml                  # CD pipeline (Docker build, push to GHCR)
├── e2e/                            # Playwright E2E tests
│   └── global-setup.ts            # Test DB migration setup
├── data/                           # Local dev database (gitignored)
├── .env                            # Local dev env vars (gitignored)
├── .env.example                    # Template for env vars
├── .dockerignore                   # Docker build context exclusions
├── drizzle.config.ts               # Drizzle migration config
├── svelte.config.js
├── tailwind.config.js
├── vite.config.ts
├── playwright.config.ts            # Playwright config (globalSetup, webServer, test DB env)
├── package.json
├── Dockerfile                      # Multi-stage Docker build
├── docker-compose.yml              # Docker Compose with volume persistence
└── README.md
```

---

## Implementation Progress

1. ~~**Project scaffolding**~~ - SvelteKit, Tailwind, shadcn-svelte, Vitest, Playwright setup
2. ~~**Database setup**~~ - Drizzle, schema, migrations, in-memory test DB helper
3. ~~**Docker, CI/CD**~~ - Dockerfile, Docker Compose, GitHub Actions CI/CD pipelines
4. ~~**Core layout**~~ - App shell, hamburger menu, navigation
5. ~~**Programs CRUD**~~ - Create, edit, list, delete, duplicate, activate programs
6. **Exercise library** - Auto-population, list, edit, delete _(next)_
7. **Workout flow** - Start, log sets, stop, summary
8. **Progressive overload** - Previous/max queries and display
9. **History views** - By date, by exercise, delete logs
10. **PWA/Offline** - Service worker, IndexedDB queue, sync
11. **Export** - JSON and CSV download
12. **Polish** - Empty states, loading states, error handling

# Workout Tracker - Implementation Plan

This document describes the build order for the Workout Tracker application. Each phase builds on the previous one. A developer should work through these phases sequentially.

Refer to `REQUIREMENTS.md` for user stories and `TECHNICAL_DESIGN.md` for architecture details.

---

## Phase 1: Project Scaffolding

Set up the project skeleton with all tooling configured and a "hello world" page running.

- Initialize SvelteKit 2 project with Svelte 5 and TypeScript
- Install and configure TailwindCSS
- Install and configure shadcn-svelte (monochromatic theme: black/white/grey)
- Install and configure Vitest (unit testing)
- Install and configure Playwright (E2E testing)
- Set up `.env.example` with `DATABASE_PATH`
- Set up `.gitignore` (include `data/`, `.env`, node_modules, etc.)
- Verify the dev server runs and a basic page renders
- Verify `npm run test:unit` and `npm run test:e2e` both execute (even with no tests yet)

**Done when**: A blank SvelteKit app runs locally with Tailwind styles, shadcn components available, and both test runners working.

---

## Phase 2: Database Foundation

Set up Drizzle ORM, define the full schema, and run migrations. Create a test helper for in-memory SQLite.

- Install Drizzle ORM and `better-sqlite3`
- Create `src/lib/server/db/schema.ts` with all tables (see TECHNICAL_DESIGN.md for schema)
- Create `drizzle.config.ts`
- Generate and run initial migration
- Create `src/lib/server/db/index.ts` - DB connection that reads `DATABASE_PATH` from env (fail loudly if not set)
- Create a test helper that provides a fresh in-memory SQLite database with migrations applied (for unit tests)
- Write a basic smoke test: insert a program, read it back

**Done when**: The database initializes on app start, migrations run, and unit tests can use an in-memory DB.

---

## Phase 3: Docker, CI/CD Pipeline

Set up the Dockerfile, Docker Compose, and GitHub Actions workflows. The Docker setup is done first because the CD pipeline needs it to build and push images.

### Docker Setup

- Create `Dockerfile` (Node.js base, build SvelteKit, run with node adapter)
- Create `docker-compose.yml` with volume mount for database
- Configure SvelteKit node adapter
- Ensure `DATABASE_PATH` is required at startup (fail with clear error if missing)
- Test full build and run in Docker locally
- Document deployment steps in `README.md`

### CI Workflow (runs on every push and PR)

- **Lint**: Run ESLint and Prettier check to enforce code style
- **Type check**: Run `svelte-check` to catch TypeScript errors
- **Unit tests**: Run Vitest
- **E2E tests**: Run Playwright (with browser install step)
- **Build verification**: Run `npm run build` to ensure production build succeeds

### CD Workflow (runs on push to main)

- Build the Docker image
- Push to GitHub Container Registry (ghcr.io)
- Tag images with commit SHA and `latest`

### Setup

- Create `.github/workflows/ci.yml` for the CI pipeline
- Create `.github/workflows/cd.yml` for the CD pipeline
- Add ESLint and Prettier configs to the project (if not already done in Phase 1)
- Ensure all `npm run` scripts are defined: `lint` (includes Prettier check), `check` (svelte-check), `test:unit`, `test:e2e`, `build`

**Done when**: `docker compose up` starts the app locally, data persists across container restarts. Pushing code triggers CI checks. Merging to main builds and pushes a Docker image to GHCR.

---

## Phase 4: Core Layout

Build the app shell that every page lives inside: hamburger menu, navigation, and the offline indicator placeholder.

- Create root `+layout.svelte` with the app shell
- Implement hamburger menu using shadcn Sheet component
  - Navigation links: Home, History, Programs, Exercises, Settings
  - Highlight current page
- Set up the monochromatic theme (black/white/grey palette in Tailwind config)
- Mobile-first responsive layout with appropriate touch targets
- Add placeholder pages for all routes (just a heading for now): `/`, `/history`, `/programs`, `/exercises`, `/settings`
- Add `ResumeWorkoutBanner` component (hidden for now, will be wired up in Phase 7)
- Add `OfflineIndicator` component (hidden for now, will be wired up in Phase 10)

**Done when**: You can navigate between all sections via the hamburger menu on mobile. All pages are placeholders.

---

## Phase 5: Programs CRUD 

Build the full program management experience. This is done before the workout flow because you need programs to exist before you can start workouts.

### 5a: Query Layer 

16 query functions in `src/lib/server/db/queries/programs.ts` with 37 unit tests in `programs.test.ts`:

- `createProgram(name)` - creates a program
- `getProgram(id)` - returns program with days and exercises
- `getAllPrograms()` - returns all programs with active indicator
- `updateProgram(id, data)` - updates program name
- `deleteProgram(id)` - deletes program (cascade days/day_exercises, but NOT workout sessions)
- `duplicateProgram(id, newName)` - deep copies program with all days and exercises
- `setActiveProgram(id)` - deactivates current active, activates the given one
- `getActiveProgram()` - returns the currently active program with days and exercises
- `addWorkoutDay(programId, name)` - adds a day with correct sort order
- `removeWorkoutDay(dayId)` - removes a day
- `renameWorkoutDay(dayId, name)` - renames a day
- `reorderWorkoutDays(programId, dayIds[])` - updates sort order for all days
- `addDayExercise(dayId, exerciseName, setsCount)` - adds exercise to day (auto-creates exercise in library if new)
- `removeDayExercise(dayExerciseId)` - removes exercise from day
- `updateDayExerciseSets(dayExerciseId, setsCount)` - changes set count
- `reorderDayExercises(dayId, dayExerciseIds[])` - updates sort order

### 5b: UI

- **Programs list page** (`/programs`) — list with dropdown actions (Edit, Duplicate, Set Active, Delete), AlertDialog for delete confirmation, Dialog for duplicate name prompt, empty state
- **Create program page** (`/programs/new`) — shared `ProgramForm` component with dynamic days/exercises, reordering, client-side validation, datalist autocomplete
- **Edit program page** (`/programs/[programId]`) — same ProgramForm pre-populated with existing data
- **Shared component**: `src/lib/components/program/ProgramForm.svelte` — used by both create and edit pages
- **shadcn-svelte components installed**: dialog, alert-dialog, dropdown-menu, badge, card, input, label, separator, popover, command

### 5c: E2E Tests

8 serial Playwright tests in `e2e/program-management.test.ts` covering: empty state, create (single day), create (multiple days), activate, switch active, duplicate, edit, delete. E2E infrastructure: `e2e/global-setup.ts` for test database migration.

**Done**: Full program management through the UI. Programs list shows active indicator. All 42 unit tests and 9 E2E tests pass.

---

## Phase 6: Exercise Library

Build the exercise library page. By this point, exercises already get auto-created when building programs (Phase 5). This phase adds the dedicated management page.

### 6a: Query Layer

Write query functions with unit tests:

- `getAllExercises()` - returns all exercises with stats (max weight, last performed date)
- `renameExercise(id, newName)` - renames exercise everywhere
- `deleteExercise(id)` - deletes from library, keeps historical logs (set FK to null), shows warning if has history
- `getExerciseStats(id)` - max weight (with reps and date), last performed date

### 6b: UI

- **Exercise library page** (`/exercises`):
  - List all exercises alphabetically
  - Per exercise: name, max weight for reps, last performed date
  - Edit name (inline or dialog)
  - Delete with confirmation (warning if has history)
  - Empty state

### 6c: E2E Tests

- View exercises created from program building
- Rename an exercise
- Delete an exercise (with and without history)

**Done when**: Exercise library page displays all exercises with stats. Renaming and deleting works correctly.

---

## Phase 7: Workout Flow

The core experience. This is the most complex phase and builds the workout logging screen, session management, and summary.

### 7a: Query Layer

Write query functions with unit tests:

- `getInProgressWorkout()` - returns current in-progress session (if any)
- `startWorkout(workoutDayId)` - creates session, exercise_logs, empty set_logs. Fails if a workout is already in progress
- `getWorkoutSession(sessionId)` - returns session with all exercise logs, set logs, and progressive overload hints
- `updateSetLog(setLogId, weight, reps, unit)` - updates a single set immediately
- `skipExercise(exerciseLogId)` - marks exercise as skipped
- `unskipExercise(exerciseLogId)` - reverts a skip (in case of accidental tap)
- `addAdhocExercise(sessionId, exerciseName)` - adds ad-hoc exercise with 3 default sets, auto-creates in library if new
- `addSetToExerciseLog(exerciseLogId)` - adds another set row
- `removeSetFromExerciseLog(setLogId)` - removes a set row
- `completeWorkout(sessionId)` - sets status to completed, marks unlogged exercises as skipped, sets completedAt
- `getWorkoutSummary(sessionId)` - returns completed vs planned count, any PRs hit
- `getPreviousPerformance(exerciseId)` - last logged (non-skipped) sets for this exercise in any program
- `getMaxPerformance(exerciseId)` - heaviest weight ever for this exercise
- `closeStaleWorkouts()` - auto-closes workouts older than 4 hours
- `updateExerciseUnitPreference(exerciseId, unit)` - persists kg/lbs preference per exercise

### 7b: UI

- **Home screen** (`/`):
  - Show active program name and workout day buttons
  - "Last workout: [day name], [X days ago]" context line
  - Tapping a day starts a workout (POST, redirect to logging screen)
  - If no active program, show empty state with link to Programs
  - If workout in progress, show resume banner (links to active session)
  - Block starting a new workout if one is in progress
  - Run stale workout cleanup on load
- **Workout logging screen** (`/workout/[sessionId]`):
  - Exercise dropdown at top to navigate between exercises
  - Progressive overload hints: "Previous" and "Max" with dates
  - All sets displayed as a form (weight input, reps input per row)
  - Unit label on weight input (tap to toggle kg/lbs, persists per exercise)
  - Skip exercise button
  - Add ad-hoc exercise button (opens dialog with type-ahead input)
  - Add/remove set buttons for ad-hoc exercises
  - Stop button with confirmation dialog
  - Each set saves immediately on input change (blur/change event)
- **Workout summary screen** (shown after stopping):
  - Exercises completed vs planned (e.g., "5/6 exercises")
  - List of PRs hit (new max weight on any exercise)
  - Congratulatory message if all planned exercises were completed
  - "Done" button returns to home

### 7c: E2E Tests

- Full workout flow: start → log sets → switch exercises → skip one → stop → verify summary
- Ad-hoc exercise addition
- Resume workout after navigating away
- Blocked from starting second workout
- PR detection
- Congratulatory message on full completion

**Done when**: You can start a workout from the home screen, log all your sets, see progressive overload hints, skip/add exercises, stop, and see a summary. Data persists immediately.

---

## Phase 8: History

Build both history views (by date and by exercise) and the ability to delete logs.

### 8a: Query Layer

Write query functions with unit tests:

- `getSessionsByDate(page?, limit?)` - returns workout sessions ordered by date with exercise summaries
- `getSessionDetail(sessionId)` - returns full session with all exercise logs and set logs
- `getHistoryByExercise()` - returns exercises with their session count and last performed
- `getExerciseHistory(exerciseId, page?, limit?)` - returns all historical logs for a specific exercise
- `deleteSession(sessionId)` - deletes a workout session and all its logs
- `deleteExerciseLog(exerciseLogId)` - deletes a single exercise log entry

### 8b: UI

- **History by date page** (`/history`, default):
  - List of workout sessions ordered by most recent
  - Each card shows: date, program name, day name, exercise count
  - Tap to expand or navigate to session detail
  - Session detail shows all exercises with set details (weight, reps, unit)
  - Skipped exercises visually distinct (greyed out, "Skipped" label)
  - Delete session option with confirmation
- **History by exercise page** (`/history/by-exercise`):
  - List of all exercises
  - Tap to see all historical entries for that exercise
  - Each entry: date, program/day context, all sets
  - Delete individual log option
- **View toggle**: Switch between "By Date" and "By Exercise" at top of history page

### 8c: E2E Tests

- View history after logging workouts
- Toggle between views
- Verify skipped exercises display correctly
- Delete a session, delete an individual log
- Verify deleted data no longer appears

**Done when**: Both history views work, skipped exercises are clearly marked, and deletion works without affecting other data.

---

## Phase 9: Settings & Export

Build the settings page with data export functionality.

### 9a: Query Layer

Write query functions with unit tests:

- `exportAsJSON()` - assembles full JSON export (programs with days, exercises, progressive overload data baked in, plus exercise library)
- `exportAsCSV()` - assembles denormalized CSV (one row per set, with session/program/day/exercise context)

### 9b: UI

- **Settings page** (`/settings`):
  - "Export as JSON" button - triggers download of `.json` file
  - "Export as CSV" button - triggers download of `.csv` file
  - Any future settings can go here

### 9c: E2E Tests

- Export JSON, verify file downloads and structure is correct
- Export CSV, verify file downloads and structure is correct

**Done when**: Both export formats download correctly with all data included.

---

## Phase 10: PWA & Offline Support

Add Progressive Web App capabilities and offline resilience.

- Install and configure `@vite-pwa/sveltekit`
- Set up service worker for app shell caching (HTML, CSS, JS cached for offline loading)
- Create PWA manifest (app name, icons, theme colors matching monochromatic design)
- Implement IndexedDB queue for offline writes (`src/lib/offline/queue.ts`)
- Implement sync logic (`src/lib/offline/sync.ts`) - retry queued writes when back online
- Create `/api/sync` endpoint to process queued actions
- Wire up `OfflineIndicator` component:
  - Shows "Offline" when disconnected
  - Shows pending sync count when reconnected and syncing
  - Disappears when fully synced
- Modify set logging to write to IndexedDB queue when server is unreachable
- Test offline behavior: log sets offline, reconnect, verify sync
- Add periodic sync (every 30 seconds while app is active)

**Done when**: The app loads without internet, sets logged offline are queued and synced when connection returns, and the offline indicator works correctly.

---

## Phase 11: Polish

Final pass for quality and edge cases.

- Empty states for all pages (no programs, no exercises, no history)
- Loading states where needed
- Error handling for form actions (display errors to user)
- Input validation (no negative weights, no empty exercise names, etc.)
- Touch target sizing audit (minimum 44x44px for all interactive elements)
- Test on actual mobile device in gym conditions
- Keyboard behavior on mobile (numeric keyboard for weight/reps inputs)
- Ensure all destructive actions have confirmation dialogs

**Done when**: The app feels solid on mobile, handles edge cases gracefully, and is ready for daily use.

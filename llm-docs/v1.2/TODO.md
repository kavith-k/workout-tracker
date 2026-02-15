# v1.2 TODO

## 1. Documentation Overhaul

The current documentation is scattered across `llm-docs/v1/`, `llm-docs/v1.1/`, `CLAUDE.md`, and `README.md`. The `llm-docs/` folders are build-time artefacts (plans, phase checklists, issue trackers) rather than proper project documentation. A developer cloning this repo has no single place to understand the app's architecture, data model, or feature set.

### Goals

- Create a `docs/` folder at the project root with clean, permanent documentation.
- Extract and consolidate architectural information from `llm-docs/v1/TECHNICAL_DESIGN.md` and `CLAUDE.md` into `docs/`:
  - `docs/architecture.md` — tech stack, directory structure, component organisation, data flow.
  - `docs/database.md` — schema overview, table relationships, migration workflow.
  - `docs/offline.md` — offline queue design, sync endpoint, IndexedDB usage, action types.
  - `docs/deployment.md` — Docker, docker-compose, reverse proxy setup, HTTPS, data persistence (move detailed deployment content out of README).
- Rewrite `README.md` to be concise and user-facing:
  - What the app is (one paragraph).
  - Screenshots or a demo GIF (optional, placeholder link).
  - Requirements (Node 22+, Docker).
  - Quick start for local dev (3-4 lines).
  - Quick start for Docker deployment (3-4 lines).
  - Link to `docs/` for everything else.
- The `llm-docs/` folders can remain for historical reference but should not be the source of truth for anything.

### Files to create or modify

| File | Action |
|---|---|
| `docs/architecture.md` | Create — tech stack, directory layout, component organisation |
| `docs/database.md` | Create — schema, relationships, migrations |
| `docs/offline.md` | Create — offline queue, sync, IndexedDB |
| `docs/deployment.md` | Create — Docker, reverse proxy, HTTPS, persistence |
| `README.md` | Rewrite — concise, links to `docs/` |
| `CLAUDE.md` | Trim — remove architecture prose, keep agent instructions |

---

## 2. Save Horizontal Space in Program Creation

The program creation form (`src/lib/components/program/ProgramForm.svelte`) uses up/down arrow buttons (ChevronUp/ChevronDown) to reorder both days and exercises within days. Each item gets two buttons, consuming horizontal space on narrow screens. Additionally, set deletion during workouts takes space that may be unnecessary for standard prescribed sets.

### 2a. Drag-to-reorder exercises and days

Replace the arrow buttons with a drag handle (grip/move icon) and implement touch-friendly drag-and-drop reordering.

**Current implementation:**
- `ProgramForm.svelte` lines 90-127: `moveDayUp`, `moveDayDown`, `moveExerciseUp`, `moveExerciseDown` functions that splice array elements.
- Lines 212-233: Day arrow buttons rendered per day.
- Lines 266-288: Exercise arrow buttons rendered per exercise within each day.

**What to change:**
- Remove the up/down ChevronUp/ChevronDown button pairs.
- Add a drag handle icon (e.g., `GripVertical` from lucide) to each day row and each exercise row.
- Implement drag-and-drop reordering. Options:
  - Native HTML5 drag-and-drop with touch polyfill.
  - A lightweight library like `svelte-dnd-action` or similar.
- Ensure it works well on mobile (touch drag, not just mouse).
- The underlying data mutation stays the same (splice the `days` array or `days[i].exercises` array), just triggered by drag end instead of button click.
- Update `sortOrder` values on save as before.

### 2b. Remove set deletion for standard sets

During a workout, each set row in `ExerciseStep.svelte` shows a delete button (lines 135-144, rendered when `exercise.sets.length > 1`). For a standard workout where the user does the prescribed number of sets (e.g., 3), the delete button is unnecessary clutter.

**What to change:**
- Only show the delete button on sets that were manually added (ad-hoc sets beyond the prescribed count).
- The prescribed set count comes from `dayExercises.sets` in the schema (`schema.ts` line 48). This value is available when the workout is started and exercise logs are created.
- Need to pass the prescribed set count to `ExerciseStep` and only render the delete button on sets whose index exceeds that count.

---

## 3. Copy Previous Set Values

When logging a workout, users often repeat the same weight and reps across multiple sets. Currently, each set's weight and reps inputs start empty, requiring manual entry every time.

### Goal

Add a mechanism to copy the previous set's weight and/or reps into the current set's input fields.

**Current implementation:**
- `ExerciseStep.svelte` lines 111-133: Weight and reps `Input` components per set row.
- Values default to `null` (rendered as empty).
- No auto-fill or copy mechanism exists.

### Design options (pick one or combine)

1. **Copy button per set row**: A small button (e.g., a clipboard or copy-down icon) next to or between the weight/reps inputs that, when tapped, fills that set's weight and reps with the values from the set above it (set index - 1). Disabled on the first set.

2. **Copy-down on the set header row**: A single button on the set table header that fills all empty sets with the first set's values (bulk fill).

3. **Long-press or double-tap on input**: Auto-fills from previous set on a gesture. 

### Implementation notes

- The copy should populate both weight and reps from the previous set in the same exercise (not from a previous workout session — that's what the progressive overload hints are for).
- Trigger the same `onupdateset` callback so the values are tracked in local state.
- Copying should never be possible existing values. It should only be available for empty fields.
- Only operates on sets within the current exercise card.

---

## 4. Show Volume During Workout

Currently, volume (weight x total reps) is only calculated at workout completion in `getWorkoutSummary()` (`workouts.ts` lines 283-383). During the workout, only "Previous" and "Max" hints are shown per exercise. There is no live feedback on current vs. previous volume to motivate the user.

### Goal

Display current volume and previous volume per exercise while the user is working out, so they can see at a glance whether they are on track to beat their previous session.

### Design

**Per-exercise volume display on `ExerciseStep.svelte`:**
- Calculate current volume from the sets already logged in the current session for this exercise: `sum(weight * reps)` for each set where both weight and reps are filled.
- Show previous volume from the most recent completed session for the same exercise (data already fetched via `getPreviousPerformance` — just needs summing).
- Display format: `Volume: 1,200 kg (prev: 1,050 kg)` or similar.
- Use the exercise's own unit (kg or lbs) — do not convert. Show the unit label.

**Where to place it:**
- The workout wizard now shows one exercise per card (`ExerciseStep`), freeing up vertical space.
- The progressive overload hints section (lines 68-85 in `ExerciseStep.svelte`) already shows "Previous" and "Max". Volume could sit alongside or below these hints.
- Consider reorganising the hints area: group "Previous sets", "Max", and "Volume comparison" into a compact stats block at the top of the exercise card.

### Data flow

- Previous performance data is already loaded in `+page.server.ts` (lines 16-41) and passed to `ExerciseStep` as `exercise.previousPerformance`.
- Previous volume = `sum(weight * reps)` across all sets in `exercise.previousPerformance.sets`.
- Current volume = computed reactively from the local set state in `ExerciseStep`.
- No new server queries needed — all data is already available client-side.

### Volume unit handling

- Use whatever unit the exercise's sets are in (kg or lbs). Do not convert.
- Display the unit explicitly: "1,200 kg" or "2,640 lbs".
- Note: `getWorkoutSummary()` currently converts everything to kg for the summary page. That can stay as-is.

---

## 5. Consistency Visualisation (GitHub-style Grid)

Add a GitHub-style contribution/activity grid to the home page showing workout consistency over a configurable period (month or year).

### Goal

Give the user a quick visual indicator of how consistently they have been training. Each cell in the grid represents a day; filled/coloured cells indicate days where a workout was completed.

### Design

- **Grid layout**: 7 rows (days of the week) x 12 columns (weeks). Similar to GitHub's contribution graph. Horizontally scrollable to see history.
- **Colour intensity**: Just binary (worked out / didn't). No need to vary intensity of colour.
- **Placement**: Home page (`src/routes/+page.svelte`), below the active program section or above the workout day buttons.

### Data requirements

- Query: all `workoutSessions` with `status = 'completed'` and `completedAt`.
- Group by date (day). Each unique date with at least one completed session = filled cell.
- New server query needed in `+page.server.ts` load function (or a dedicated query in `workouts.ts`).

### Implementation notes

- Build as a standalone component: `src/lib/components/home/ConsistencyGrid.svelte` (or similar).
- Use CSS grid or SVG for the layout.
- Needs to handle the current day marker (today).
- Keep it lightweight; this is a read-only visualisation with no interactivity other than scrolling horizontally to view more than 3 months of data (if it exists).
- Mobile-first: ensure it fits within the viewport width. Horizontal scroll is acceptable for longer periods.

---

## 6. Cancel Empty Workouts

Currently, when a user finishes a workout without logging any reps against any exercise, the workout is still saved with all exercises marked as "skipped" and `status = 'completed'`. This clutters history with meaningless entries.

### Goal

If no reps are logged against any exercise in the session, treat the workout as cancelled rather than completed. Do not store it in history.

### Current behaviour

- `completeWorkout()` in `workouts.ts` (lines 255-281):
  - Iterates exercise logs, marks those without filled sets (where `weight IS NOT NULL`) as skipped.
  - Sets session `status = 'completed'` and `completedAt = now()`.
  - Does not check whether the entire workout is empty.
- The summary page then shows "0/N exercises completed" but the session exists in history.

### What to change

- In `completeWorkout()`, after marking individual exercises as skipped, check if **any** exercise log still has `status = 'logged'` (i.e., has at least one set with reps filled).
- If zero exercises are logged:
  - Delete all `setLogs` for this session.
  - Delete all `exerciseLogs` for this session.
  - Delete the `workoutSession` itself.
  - Return a flag or distinct response indicating the workout was cancelled.
- On the client side (`+page.server.ts` stop action and `WorkoutWizard.svelte` offline handling):
  - If the server returns "cancelled", redirect to home instead of the summary page.
  - Show a brief toast or message: "Workout cancelled — no exercises were logged."
- For offline mode: the `COMPLETE_WORKOUT` sync action should apply the same logic when processed by the sync endpoint.
- The check should be based on `reps IS NOT NULL`. A set with reps but no weight is arguably still a logged set (bodyweight exercises).

---

## 7. Investigate Offline Mode over HTTP

Service workers (and by extension, the offline queue sync and any future caching) require a secure context. Browsers restrict service worker registration to HTTPS origins (with `localhost` as the sole exception).

### Goal

Investigate whether the app's offline features can work over plain HTTP (e.g., when accessed on a local network without TLS), and document the findings for future developers.

### What to investigate

1. **Which browsers enforce the HTTPS requirement for service workers?** Is it all modern browsers or are there exceptions?
2. **Does the current offline implementation actually depend on a service worker?** The app uses IndexedDB for queuing and a JS-based sync loop (`src/lib/offline/sync.ts`) — these do not require a service worker. The service worker (via `@vite-pwa/sveltekit`) may only be needed for asset caching / "install as app" functionality. Clarify what breaks on HTTP vs. what still works.
3. **Are there workarounds?** For example:
   - Chrome flags (`--unsafely-treat-insecure-origin-as-secure`).
   - `localhost` aliases (e.g., adding a hosts entry for `workout.local` pointing to the server's LAN IP — does this count as localhost?).
   - Self-signed certificates with trust store installation.
   - mDNS / `.local` domains.
4. **What is the realistic recommendation?** For a self-hosted app on a home network, is HTTPS via a reverse proxy the only practical path, or are there simpler alternatives?

### Output

Write findings to `llm-docs/v1.2/offline-mode-http.md`. Structure:
- Summary of the problem.
- What currently works on HTTP vs. what does not.
- Browser-by-browser breakdown if relevant.
- Workaround options with pros/cons.
- Recommendation for self-hosters.

# Workout Tracker - Product Requirements

## Overview

A self-hosted workout tracking application for personal use. The app allows users to build workout programs, log individual workout sessions, and track progress over time with a focus on progressive overload.

**Target User**: Single user (no authentication required)
**Primary Device**: Mobile phone (used in the gym)
**Design Philosophy**: Monochromatic (black/white/grey), minimalist, no-nonsense, optimized for quick interactions with good touch targets

---

## Tech Stack

- **Frontend**: SvelteKit 2 (Svelte 5)
- **Styling**: TailwindCSS + shadcn-svelte
- **Database**: SQLite
- **Runtime**: Node.js (self-hosted)

---

## Core Concepts

### Workout Program
A structured training plan consisting of multiple workout days. Only one program can be "active" at a time, but multiple programs can exist (inactive ones can be reactivated later).

**Example**: An Upper-Lower split program with 4 days:
- Upper-1
- Lower-1
- Upper-2
- Lower-2

### Workout Day
A named day within a program containing a list of exercises with prescribed sets.

### Exercise
A movement tracked in the system. Exercises exist in a global library that auto-populates as users create programs. If an exercise doesn't exist when added to a program, it gets created automatically.

### Workout Session (Log)
A recorded instance of performing a workout day. Contains logged sets for each exercise performed.

### Set
A single work set for an exercise, tracking:
- **Weight**: The load used (in kg or lbs)
- **Reps**: Number of repetitions completed

---

## User Stories

### Home Screen

**US-001**: As a user, when I open the app, I want to see my current active program with each workout day displayed as a large, tappable button so I can quickly start logging.

**US-002**: As a user, I want to see when my last workout was (e.g., "Last workout: Upper-1, 2 days ago") for context on my training frequency.

**US-003**: As a user, I want easy access to History, Programs, Exercises, and Settings from the home screen via navigation (bottom nav or menu).

**US-004**: As a user, if I have no active program, I want to be guided to create or activate one.

---

### Starting a Workout

**US-010**: As a user, I want to tap a workout day button on the home screen to immediately start a workout session for that day.

**US-011**: As a user, starting a workout should take me directly to the logging screen with the first exercise ready to log (2 taps from app open to logging).

---

### Logging a Workout

**US-020**: As a user, I want to see all prescribed sets for the current exercise displayed at once in a form-style layout so I can fill them in as I complete them.

**US-021**: As a user, for each set I want to enter:
- Weight (numeric input)
- Reps (numeric input)

**US-022**: As a user, I want to see progressive overload hints for each exercise showing:
- **Previous**: The weight and reps from the last time I performed this exercise (in any program), with the date
- **Max**: The heaviest weight I've ever lifted for this exercise, with the date

**US-023**: As a user, I want to navigate between exercises using a dropdown list so I can do exercises in any order I choose.

**US-024**: As a user, I want to be able to skip an exercise entirely if I don't want to do it that day. Skipped exercises should be explicitly marked as "skipped" in history.

**US-025**: As a user, if I skip an exercise, the progressive overload hints next time should show actual historical data (not the skipped entry).

**US-026**: As a user, I want to be able to do fewer sets than prescribed. Unlogged sets should be recorded as 0 (not performed).

**US-027**: As a user, I want to add ad-hoc exercises that aren't part of the program for that day. Ad-hoc exercises should default to 3 sets but allow me to add or remove sets.

**US-028**: As a user, I want to see a "Stop" button to end my current workout session.

**US-029**: As a user, when I tap "Stop", I want a confirmation dialog before the workout ends to prevent accidental taps.

---

### Weight Units

**US-030**: As a user, I want weights to default to kilograms (kg).

**US-031**: As a user, I want to toggle between kg and lbs by tapping on the weight unit label for an exercise.

**US-032**: As a user, once I log an exercise in a specific unit (e.g., lbs), I want that preference to persist for that exercise in future sessions.

---

### Workout Summary

**US-040**: As a user, after ending a workout, I want to see a summary screen showing:
- Exercises completed vs. planned (e.g., "5/6 exercises completed")
- Any personal records (PRs) hit during this session (new max weight on any exercise)

**US-041**: As a user, if I completed all planned exercises, I want to see a congratulatory message or celebration to reward consistency.

---

### History

**US-050**: As a user, I want to view my workout history organized by date (default view), showing all exercises from each session grouped together.

**US-051**: As a user, I want to view my workout history organized by exercise, showing all historical entries for a specific exercise.

**US-052**: As a user, I want to be able to switch between "by date" and "by exercise" views.

**US-053**: As a user, I want to see skipped exercises clearly marked as "skipped" in the history.

**US-054**: As a user, I want to be able to delete individual workout logs from history.

---

### Programs

**US-060**: As a user, I want to create a new workout program by:
- Giving it a name
- Adding workout days (each with a name)
- Adding exercises to each day with a specified number of sets

**US-061**: As a user, when adding exercises to a program, if the exercise name doesn't exist in my library, it should be automatically added.

**US-062**: As a user, when adding exercises to a program, if the exercise already exists in my library, I want to select it (with autocomplete/suggestions).

**US-063**: As a user, I want the default number of sets for a new exercise to be 3, but I should be able to add more or remove sets.

**US-064**: As a user, I want to edit an existing program (add/remove/rename days, add/remove exercises, change set counts) even after I've logged workouts against it.

**US-065**: As a user, when I edit a program, historical logs should remain tied to the structure they were logged under (not retroactively updated).

**US-066**: As a user, I want to duplicate an existing program as a starting point for a new one.

**US-067**: As a user, I want to delete a program. Deleting a program should NOT delete any workout logs in history; they should remain as orphaned historical records.

**US-068**: As a user, I want to set a program as "active". Only one program can be active at a time.

**US-069**: As a user, I want to switch between programs (deactivate current, activate another).

**US-070**: As a user, I want to see a list of all my programs with a visual indicator of which one is currently active.

---

### Exercises Library

**US-080**: As a user, I want to view a list of all exercises I've ever performed or added to programs.

**US-081**: As a user, I want to see quick stats for each exercise in the library:
- Max weight ever lifted (with reps at that weight)
- Last performed date

**US-082**: As a user, I want to edit an exercise name. Renaming should update the exercise everywhere it appears.

**US-083**: As a user, I want to delete an exercise from the library. If the exercise has history:
- Show a warning
- Keep historical logs intact (orphaned)
- Remove the exercise from the library

---

### Settings

**US-090**: As a user, I want to export all my data as JSON for backup purposes.

**US-091**: As a user, I want to export all my data as CSV for analysis in spreadsheet software.

---

## Navigation Structure

```
[Home]          - Start workouts, see active program days
[History]       - View past workout logs
[Programs]      - Manage workout programs
[Exercises]     - View/manage exercise library
[Settings]      - Export data, other settings
```

---

## Screen Inventory

### 1. Home Screen
- Display current active program name
- Large tappable buttons for each workout day
- "Last workout" context line
- Navigation to other sections
- Empty state if no active program

### 2. Workout Logging Screen
- Current exercise name with dropdown to switch
- Progressive overload hints (previous + max)
- Form with all sets displayed (weight + reps inputs for each)
- Skip exercise button
- Add ad-hoc exercise button
- Stop workout button

### 3. Workout Summary Screen
- Exercises completed vs. planned
- PRs achieved (if any)
- Congratulatory message (if all exercises completed)
- Return to home button

### 4. History Screen (By Date - Default)
- List of workout sessions by date
- Each session shows: date, program name, day name, exercises performed
- Expandable to see set details
- Delete option per session

### 5. History Screen (By Exercise)
- List of all exercises
- Tap exercise to see all historical entries
- Each entry shows: date, sets/reps/weight
- Delete option per entry

### 6. Programs List Screen
- List of all programs
- Active program indicator
- Options per program: Edit, Duplicate, Delete, Set Active

### 7. Program Editor Screen
- Program name input
- List of workout days
- Add/remove/rename days
- Per day: list of exercises with set counts
- Add/remove exercises, adjust set counts

### 8. Exercises Library Screen
- List of all exercises
- Quick stats (max weight, last performed)
- Edit name option
- Delete option (with warning if has history)

### 9. Settings Screen
- Export as JSON button
- Export as CSV button
- (Future: other settings as needed)

---

## Data Relationships

```
Program (1) ──────< Workout Day (many)
Workout Day (1) ──────< Day Exercise (many) [exercise + set count]
Exercise (1) ──────< Day Exercise (many)

Workout Session (1) ──────< Exercise Log (many)
Exercise Log (1) ──────< Set Log (many)
Exercise (1) ──────< Exercise Log (many)

Workout Session >────── Program (optional, for reference)
Workout Session >────── Workout Day (optional, for reference)
```

---

## Edge Cases & Rules

1. **No active program**: Home screen shows empty state with prompt to create/activate a program.

2. **Exercise with no history**: Progressive overload hints show nothing (or "First time!").

3. **All sets logged as 0**: Exercise is considered "not performed" but still logged.

4. **Skipped exercise**: Explicitly marked, excluded from progressive overload hints for "previous".

5. **Deleted exercise with history**: History remains, exercise removed from library, historical entries show exercise name but marked as deleted/orphaned.

6. **Deleted program with history**: All workout logs remain intact, program reference may show as deleted/archived.

7. **Ad-hoc exercise during workout**:
   - If exercise exists in library: use it
   - If exercise is new: add to library automatically
   - Default to 3 sets, allow adding/removing sets

8. **Unit persistence**: Each exercise remembers its last-used unit (kg/lbs) and defaults to that unit in future sessions.

---

## Out of Scope for V1

- User authentication / multi-user support
- Workout timers / rest timers
- RIR (Reps in Reserve) tracking
- Workout notes
- Exercise metadata (muscle groups, equipment type)
- 1RM calculations
- Charts / graphs for progress visualization
- Mobile app (PWA or native) - web only for now
- Import data functionality

---

## Success Criteria

1. User can create a program and start logging workouts within 2 minutes of first use
2. User can go from app open to logging their first set in 2 taps
3. Progressive overload hints are accurate and helpful
4. Data persists reliably in SQLite
5. Data can be exported for backup
6. UI is responsive and usable on mobile with one hand
7. App is self-hostable on a home server with minimal configuration

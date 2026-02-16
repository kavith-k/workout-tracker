# Database

SQLite database managed by Drizzle ORM. Schema defined in `src/lib/server/db/schema.ts`.

## Connection

The database path is auto-detected:

- **Local dev**: `./data/workout-tracker.db` (created automatically)
- **Docker**: `/data/workout-tracker.db` (detected by the presence of `/data/`)

No environment variables required.

## Schema

```
programs
  id              INTEGER PK autoincrement
  name            TEXT NOT NULL
  is_active       BOOLEAN NOT NULL DEFAULT false
  created_at      TIMESTAMP NOT NULL
  updated_at      TIMESTAMP NOT NULL

workout_days
  id              INTEGER PK autoincrement
  program_id      INTEGER FK -> programs(id) ON DELETE CASCADE
  name            TEXT NOT NULL
  sort_order      INTEGER NOT NULL
  created_at      TIMESTAMP NOT NULL

exercises
  id              INTEGER PK autoincrement
  name            TEXT NOT NULL UNIQUE
  unit_preference TEXT NOT NULL DEFAULT 'kg' ('kg' | 'lbs')
  created_at      TIMESTAMP NOT NULL

day_exercises
  id              INTEGER PK autoincrement
  workout_day_id  INTEGER FK -> workout_days(id) ON DELETE CASCADE
  exercise_id     INTEGER FK -> exercises(id)
  sets_count      INTEGER NOT NULL DEFAULT 3
  sort_order      INTEGER NOT NULL
  created_at      TIMESTAMP NOT NULL

workout_sessions
  id              INTEGER PK autoincrement
  program_id      INTEGER FK -> programs(id) ON DELETE SET NULL (nullable)
  workout_day_id  INTEGER FK -> workout_days(id) ON DELETE SET NULL (nullable)
  program_name    TEXT NOT NULL (snapshot)
  day_name        TEXT NOT NULL (snapshot)
  status          TEXT NOT NULL DEFAULT 'in_progress' ('in_progress' | 'completed')
  started_at      TIMESTAMP NOT NULL
  completed_at    TIMESTAMP (nullable)

exercise_logs
  id              INTEGER PK autoincrement
  exercise_id     INTEGER FK -> exercises(id) ON DELETE SET NULL (nullable)
  session_id      INTEGER FK -> workout_sessions(id) ON DELETE CASCADE
  exercise_name   TEXT NOT NULL (snapshot)
  status          TEXT NOT NULL DEFAULT 'logged' ('logged' | 'skipped')
  is_adhoc        BOOLEAN NOT NULL DEFAULT false
  sort_order      INTEGER NOT NULL
  created_at      TIMESTAMP NOT NULL

set_logs
  id              INTEGER PK autoincrement
  exercise_log_id INTEGER FK -> exercise_logs(id) ON DELETE CASCADE
  set_number      INTEGER NOT NULL
  weight          REAL (nullable)
  reps            INTEGER (nullable)
  unit            TEXT NOT NULL DEFAULT 'kg' ('kg' | 'lbs')
  created_at      TIMESTAMP NOT NULL
```

## Relationships

```
Program  1---*  WorkoutDay  1---*  DayExercise  *---1  Exercise
                                                        |
WorkoutSession  1---*  ExerciseLog  1---*  SetLog        |
      |                     |                            |
      *---1 Program?        *---1 Exercise?              |
      *---1 WorkoutDay?     (snapshot: exercise_name)    |
      (snapshots: program_name, day_name)
```

## Key Schema Decisions

- **Snapshot fields**: `program_name`, `day_name`, `exercise_name` are stored at workout time. Historical logs remain accurate even if the source is renamed or deleted.
- **Nullable FKs**: `program_id`, `workout_day_id`, `exercise_id` become null if the referenced entity is deleted, but snapshot fields preserve the data.
- **Sort order**: `workout_days` and `day_exercises` have `sort_order` for user-defined ordering.
- **Unit preference**: Stored per-exercise in `exercises` and per-set in `set_logs`.
- **Status tracking**: Sessions track `in_progress` vs `completed`. Exercise logs track `logged` vs `skipped`.

## Migration Workflow

```bash
# Generate a migration after changing schema.ts
npm run db:generate

# Run pending migrations
npm run db:migrate

# Push schema directly (dev only, no migration file)
npm run db:push

# Open Drizzle Studio for visual inspection
npm run db:studio
```

Migrations are stored in `drizzle/` and are copied into the Docker image at build time.

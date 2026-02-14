# v1.1 TODO

## Offline Test Coverage

Add automated tests for the three untested areas of the offline/sync pipeline. See `offline-test-improvements.md` for detailed problem statements.

- [x] Sync endpoint input validation tests
- [x] Queue retry and overflow behaviour tests
- [x] Sync engine concurrency and partial failure tests

## Remove DATABASE_PATH Env Var

The app currently requires a `DATABASE_PATH` environment variable and fails loudly if it is not set. This is unnecessary complexity. The Docker container already mounts a volume to `/data/`, so the database path can be hardcoded to `/data/workout-tracker.db`.

Changes needed:

- [x] Hardcode the database path to `/data/workout-tracker.db` in `src/lib/server/db/index.ts`
- [x] Remove the `DATABASE_PATH` check and error message from startup
- [x] Remove `DATABASE_PATH` from `.env.example`
- [x] Remove `DATABASE_PATH` references from `docker-compose.yml` environment section
- [x] Update `Dockerfile` if it sets or documents `DATABASE_PATH`
- [x] Update `README.md` deployment instructions
- [x] Ensure `data/` directory is created automatically if it does not exist
- [x] Keep `data/` in `.gitignore`

## Improve Documentation

Add deployment/self-hosting documentation covering:

- [x] Required and optional environment variables
- [x] Docker and docker-compose setup instructions
- [x] Known limitations for plain HTTP deployments (non-HTTPS)

## UI Improvements

- [x] Reduce verbose text across the app (warnings, notes, etc.)
- [x] History page: remove the "by exercise" view option
- [x] Workout complete page: improve celebration and show workout stats
- [x] The Unit doesn't need to be on a separate column in the /history page. It could just be next to the column header "Weight" in brackets like for example: Weight (kg).
- [x] Similarly, the weight unit (kg/ lbs) while recording exercises in /workout need not be repeated for each weight input. I think it could be with the header: Weight either the units are in a box that can be toggled, or there's an actual toggle to switch between units for each exercise but no necessarily for each set!
- [x] By default in the /workout page, we seem to input figures for the weight & reps fields. I would prefer if they were left empty. I can use the hints (previous & max) to gauge and set values as required.
- [ ] Check out all the Project Diagnostics warnings/ errors in Zed [Manual Check - Kavith to do]
- [x] Fix all the E2E test warnings

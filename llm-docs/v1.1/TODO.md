# v1.1 TODO

## Offline Test Coverage

Add automated tests for the three untested areas of the offline/sync pipeline. See `offline-test-improvements.md` for detailed problem statements.

- [ ] Sync endpoint input validation tests
- [ ] Queue retry and overflow behaviour tests
- [ ] Sync engine concurrency and partial failure tests

## Remove DATABASE_PATH Env Var

The app currently requires a `DATABASE_PATH` environment variable and fails loudly if it is not set. This is unnecessary complexity. The Docker container already mounts a volume to `/data/`, so the database path can be hardcoded to `/data/workout-tracker.db`.

Changes needed:

- [ ] Hardcode the database path to `/data/workout-tracker.db` in `src/lib/server/db/index.ts`
- [ ] Remove the `DATABASE_PATH` check and error message from startup
- [ ] Remove `DATABASE_PATH` from `.env.example`
- [ ] Remove `DATABASE_PATH` references from `docker-compose.yml` environment section
- [ ] Update `Dockerfile` if it sets or documents `DATABASE_PATH`
- [ ] Update `README.md` deployment instructions
- [ ] Ensure `data/` directory is created automatically if it does not exist
- [ ] Keep `data/` in `.gitignore`

## UI Improvements

- [ ] Replace hamburger menu with a better navigation pattern
- [ ] Reduce verbose text across the app (warnings, notes, etc.)
- [ ] History page: remove the "by exercise" view option
- [ ] Workout page: consider removing the exercise filter pill (not useful past the first exercise or two)
- [ ] Workout complete page: improve celebration and show workout stats
- [ ] The Unit doesn't need to be on a separate column in the /history page. It could just be next to the column header "Weight" in brackets like for example: Weight (kg).
- [ ] By default in the /workout page, we seem to input figures for the weight & reps fields. I would prefer if they were left empty. I can use the hints (previous & max) to gauge and set values as required.

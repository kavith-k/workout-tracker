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

## Improve Documentation

Add deployment/self-hosting documentation covering:

- [ ] Required and optional environment variables
- [ ] Docker and docker-compose setup instructions
- [ ] Reverse proxy configuration notes (e.g. Nginx, Traefik)
- [ ] Known limitations for plain HTTP deployments (non-HTTPS)

## UI Improvements

- [ ] Replace hamburger menu with a better navigation pattern
- [ ] Reduce verbose text across the app (warnings, notes, etc.)
- [ ] History page: remove the "by exercise" view option
- [ ] Workout page: consider removing the exercise filter pill (not useful past the first exercise or two)
- [ ] Workout complete page: improve celebration and show workout stats

# Workout Tracker

A self-hosted, mobile-first workout logging app with progressive overload tracking. Built with SvelteKit, SQLite, and Docker.

## Requirements

- Node.js 22+
- `DATABASE_PATH` environment variable pointing to a SQLite database file

## Development

```sh
cp .env.example .env
npm install
npm run dev
```

## Deployment with Docker

### Using Docker Compose (recommended)

```sh
docker compose up -d
```

This builds the image, starts the container on port 3000, and persists the database in a named volume (`workout-data`).

### Using Docker directly

```sh
docker build -t workout-tracker .
docker run -d \
  -p 3000:3000 \
  -e DATABASE_PATH=/data/workout-tracker.db \
  -v workout-data:/data \
  workout-tracker
```

### Using the pre-built image from GHCR

```sh
docker run -d \
  -p 3000:3000 \
  -e DATABASE_PATH=/data/workout-tracker.db \
  -v workout-data:/data \
  ghcr.io/kavith-k/workout-tracker:latest
```

### Environment variables

| Variable        | Required | Description                                                     |
| --------------- | -------- | --------------------------------------------------------------- |
| `DATABASE_PATH` | Yes      | Path to SQLite database file (e.g., `/data/workout-tracker.db`) |

The database file and directory are created automatically on first run.

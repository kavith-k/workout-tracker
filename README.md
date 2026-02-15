# Workout Tracker

A self-hosted, mobile-first workout logging app built with SvelteKit and SQLite. Create workout programmes, log sets with weight and reps, and track progressive overload over time. Single-user, zero-config, works offline as a PWA.

## Requirements

- Node.js 22+ (for local development)
- Docker (for deployment)

## Local Development

```sh
npm install
npm run dev
```

The database is automatically created at `./data/workout-tracker.db`.

## Docker Deployment

```sh
docker compose up -d
```

Or use the pre-built image:

```sh
docker run -d -p 3000:3000 -v workout-data:/data ghcr.io/kavith-k/workout-tracker:latest
```

## Documentation

- [Architecture](docs/architecture.md) -- tech stack, directory structure, data flow
- [Database](docs/database.md) -- schema, relationships, migration workflow
- [Offline](docs/offline.md) -- PWA, IndexedDB queue, sync engine
- [Deployment](docs/deployment.md) -- Docker, reverse proxy, HTTPS, data persistence

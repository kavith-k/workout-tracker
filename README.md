# Workout Tracker

A self-hosted, mobile-first workout logging app with progressive overload tracking. Built with SvelteKit, SQLite, and Docker.

## Requirements

- Node.js 22+

## Development

```sh
npm install
npm run dev
```

The database is automatically created at `./data/workout-tracker.db`.

## Deployment with Docker

### Using Docker Compose (recommended)

```sh
docker compose up -d
```

This starts the container on port 6789 and persists the database via a volume mount to `/data`.

### Using Docker directly

```sh
docker build -t workout-tracker .
docker run -d \
  -p 3000:3000 \
  -v workout-data:/data \
  workout-tracker
```

### Using the pre-built image from GHCR

```sh
docker run -d \
  -p 3000:3000 \
  -v workout-data:/data \
  ghcr.io/kavith-k/workout-tracker:latest
```

### Data persistence

The database is stored at `/data/workout-tracker.db` inside the container. Mount a volume to `/data` to persist data across container restarts.

### Configuration

No environment variables are required. The app is zero-config.

### HTTPS

Service workers and offline features require HTTPS in most browsers. This works automatically on `localhost`, but remote access over plain HTTP will disable offline support. Use a reverse proxy (e.g., Caddy, Traefik, nginx) to terminate TLS if accessing the app over the network.

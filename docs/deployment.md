# Deployment

## Docker Compose (recommended)

```sh
docker compose up -d
```

This starts the container on port 6789 (mapped to internal port 3000) and persists the database via a volume mount.

Example `docker-compose.yml`:

```yaml
services:
  workout-tracker:
    image: ghcr.io/kavith-k/workout-tracker:latest
    container_name: workout-tracker
    ports:
      - '6789:3000'
    volumes:
      - docker-config/workout-tracker:/data
    restart: unless-stopped
```

## Docker (manual)

### Build from source

```sh
docker build -t workout-tracker .
docker run -d \
  -p 3000:3000 \
  -v workout-data:/data \
  workout-tracker
```

### Pre-built image from GHCR

```sh
docker run -d \
  -p 3000:3000 \
  -v workout-data:/data \
  ghcr.io/kavith-k/workout-tracker:latest
```

## Data Persistence

The database is stored at `/data/workout-tracker.db` inside the container. Mount a volume or bind mount to `/data` to persist data across container restarts.

## Configuration

No environment variables are required. The app is zero-config.

## HTTPS and Reverse Proxy

Service workers and offline features require HTTPS in most browsers. This works automatically on `localhost`, but remote access over plain HTTP will disable offline support.

Use a reverse proxy (e.g., Caddy, Traefik, nginx) to terminate TLS if accessing the app over the network.

### Caddy example

```
workout.example.com {
    reverse_proxy localhost:6789
}
```

Caddy automatically provisions and renews HTTPS certificates via Let's Encrypt.

### nginx example

```nginx
server {
    listen 443 ssl;
    server_name workout.example.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:6789;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Docker Image Details

The image uses a multi-stage build:

1. **Build stage**: Node 22 Alpine, installs dependencies, builds the SvelteKit app
2. **Production stage**: Node 22 Alpine, production dependencies only, includes built output and Drizzle migrations

The container exposes port 3000 and includes a healthcheck that polls the root URL every 30 seconds.

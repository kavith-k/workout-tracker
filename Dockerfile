# Stage 1: Build
FROM node:22-alpine AS build

WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json ./

# Install all dependencies (no lockfile, so use npm install)
RUN npm install

# Copy source and build
COPY . .
ENV DATABASE_PATH=/tmp/build.db
RUN npm run build

# Stage 2: Production
FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app

# Install build tools for native module compilation during npm install
RUN apk add --no-cache python3 make g++

# Copy package files and install production deps only
COPY package.json ./
RUN npm install --omit=dev

# Remove build tools to shrink image
RUN apk del python3 make g++

# Copy built output from build stage
COPY --from=build /app/build ./build

# Create data directory for SQLite volume mount
RUN mkdir -p /data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --spider http://localhost:3000/ || exit 1

CMD ["node", "build/index.js"]

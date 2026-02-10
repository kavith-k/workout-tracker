## Project Overview

Workout Tracker — a self-hosted, mobile-first SvelteKit app for logging workouts with progressive overload tracking. Single-user, no auth. See `llm-docs/v1/REQUIREMENTS.md` for full product requirements and `llm-docs/v1/TECHNICAL_DESIGN.md` for architecture details.

## Tech Stack

- **Framework**: SvelteKit 2 (Svelte 5) with Node adapter
- **Styling**: TailwindCSS v4 + shadcn-svelte
- **Database**: SQLite via better-sqlite3 + Drizzle ORM
- **Testing**: Vitest (unit/component) + Playwright (E2E)

## Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run preview          # Preview production build
npm run check            # Svelte type checking
npm run lint             # Prettier + ESLint check
npm run format           # Auto-format with Prettier
npm run test:unit        # Vitest (watch mode)
npm run test:unit -- --run  # Vitest (single run)
npm run test:e2e         # Playwright E2E tests
npm run test             # All tests (unit + e2e)
npm run db:generate      # Generate Drizzle migrations
npm run db:migrate       # Run Drizzle migrations
npm run db:push          # Push schema directly (dev)
npm run db:studio        # Open Drizzle Studio
```

## Environment

Requires `DATABASE_PATH` env var. Copy `.env.example` to `.env` for local dev:

```
DATABASE_PATH=./data/workout-tracker.db
```

## Vitest Configuration

Two test projects configured in `vite.config.ts`:

- **`client`**: Browser-based component tests matching `src/**/*.svelte.{test,spec}.{js,ts}`, runs in headless Firefox via Playwright provider. Excludes `src/lib/server/**`.
- **`server`**: Node environment tests matching `src/**/*.{test,spec}.{js,ts}`, excludes `.svelte.` test files.

## Code Style

- Tabs for indentation, single quotes, no trailing commas, 100 char print width (`.prettierrc`)
- Svelte files parsed with `prettier-plugin-svelte` + `prettier-plugin-tailwindcss`
- ESLint with `typescript-eslint` + `eslint-plugin-svelte` + prettier compat
- Follow DRY/YAGNI principles. Write simple, clear, self-documenting code.

## Agent Documentation Standards

Any documentation written by agents must be clear, simple, and short. No unnecessary verbosity.

## Architecture

- **DB schema**: `src/lib/server/db/schema.ts` — Drizzle schema definition
- **DB connection**: `src/lib/server/db/index.ts` — creates connection using `DATABASE_PATH`
- **Drizzle config**: `drizzle.config.ts` — migration config, schema path, SQLite dialect
- **Shared utils**: `src/lib/utils.ts` — `cn()` helper for Tailwind class merging + shadcn type helpers
- **Routes**: `src/routes/` — SvelteKit file-based routing
- **Components**: `src/lib/components/` — organized by domain (layout, workout, program, history, exercises, shared, ui)
- **Server logic**: `src/lib/server/` — DB queries in `db/queries/`, utilities in `utils/`

## Documentation Lookup Rules

**CRITICAL: Never rely on training data for syntax or APIs. Always look up latest docs.**

- **Svelte/SvelteKit**: Use the Svelte MCP server (`list-sections` then `get-documentation`). Always run `svelte-autofixer` on any Svelte code before finalizing.
- **shadcn-svelte**: Use https://www.shadcn-svelte.com — index at https://www.shadcn-svelte.com/llms.txt
- **All other technologies**: Use the Context7 MCP Server for up-to-date documentation.

## Svelte MCP Tools

1. **list-sections** — Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths. When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.
2. **get-documentation** — Retrieves full documentation content for specific sections. Accepts single or multiple sections. After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.
3. **svelte-autofixer** — Analyzes Svelte code and returns issues and suggestions. You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

## Context7 MCP Tools

1. **resolve-library-id** — Resolves a general library name into a Context7-compatible library ID.

- `query` (required): The user's question or task (used to rank results by relevance)
- `libraryName` (required): The name of the library to search for

2. **query-docs** — Retrieves documentation for a library using a Context7-compatible library ID.

- `libraryId` (required): Exact Context7-compatible library ID (e.g., shadcn-svelte.com/docs, tailwindcss.com/docs)
- `query` (required): The question or task to get relevant documentation for

## Branching & PR Workflow

Each implementation phase gets its own branch and PR:

1. Create a branch named `phase-N/<short-description>` from `main`
2. Commit all work for that phase to the phase branch
3. When the phase is complete and verified, create a PR merging into `main`

### gh CLI Reference

```bash
# Create and switch to phase branch
git checkout -b phase-N/description main

# Push branch to remote
git push -u origin phase-N/description

# Create PR
gh pr create --base main --head phase-N/description \
  --title "Phase N: Description" \
  --body "Summary of changes"

# Check PR status
gh pr status
gh pr checks <pr-number>
```

## Playwright CLI

The `playwright-cli` skill is available for any Playwright browser automation actions (navigating pages, interacting with elements, taking screenshots, extracting data, etc.). Run `playwright-cli --help` for available commands.

## Phase Verification

At the end of each phase, a verifier subagent MUST be kicked off to check:

1. Everything is built as per the plan — no outstanding items
2. No regressions or bugs introduced
3. All rules in this file were followed — no shortcuts taken
4. Code quality: DRY/YAGNI, clear, self-documenting

#!/usr/bin/env bash
# Quality gate hook - runs lint, unit tests, and type checking.
# Used by the Stop hook to ensure code quality before the agent finishes.
#
# Smart skip: if no code files have changed (working tree, staged, or
# branch diff vs main), the expensive checks are skipped entirely.
set -uo pipefail

cd "$CLAUDE_PROJECT_DIR"

# File extensions that count as "code changes" worth gating
CODE_PATTERN='\.(ts|js|svelte|css|html)$'

# Collect changed files from all three sources
CHANGED_FILES=$(
	{
		git diff --name-only 2>/dev/null
		git diff --cached --name-only 2>/dev/null
		git diff main --name-only 2>/dev/null
	} | sort -u
)

# Filter to code files only
CODE_CHANGES=$(echo "$CHANGED_FILES" | grep -E "$CODE_PATTERN" || true)

if [ -z "$CODE_CHANGES" ]; then
	echo "No code changes detected — skipping quality gate." >&2
	exit 0
fi

echo "Code changes detected, running quality gate..." >&2

ERRORS=""

# Run linter (Prettier + ESLint)
echo "Running lint check..." >&2
if ! LINT_OUT=$(npm run lint 2>&1); then
	ERRORS="Lint check failed:\n${LINT_OUT}\n\n"
fi

# Run unit tests (single run, no watch mode)
echo "Running unit tests..." >&2
if ! TEST_OUT=$(npm run test:unit -- --run 2>&1); then
	ERRORS="${ERRORS}Unit tests failed:\n${TEST_OUT}\n\n"
fi

# Run Svelte type check
echo "Running type check..." >&2
if ! CHECK_OUT=$(npm run check 2>&1); then
	ERRORS="${ERRORS}Type check failed:\n${CHECK_OUT}\n\n"
fi

if [ -n "$ERRORS" ]; then
	REASON=$(printf "Quality gate failed. Fix these issues before finishing:\n\n%s" "$ERRORS")
	# Use node (guaranteed available in this SvelteKit project) to produce safe JSON
	node -e "
		const output = {
			decision: 'block',
			reason: process.argv[1]
		};
		console.log(JSON.stringify(output));
	" "$REASON"
	exit 0
fi

echo "All quality checks passed." >&2
exit 0

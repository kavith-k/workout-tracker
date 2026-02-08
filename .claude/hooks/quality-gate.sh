#!/usr/bin/env bash
# Quality gate hook - runs lint, unit tests, and type checking.
# Used by the Stop hook to ensure code quality before the agent finishes.
set -uo pipefail

cd "$CLAUDE_PROJECT_DIR"

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

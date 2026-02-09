import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	globalSetup: './e2e/global-setup.ts',
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		env: { DATABASE_PATH: './data/e2e-test.db' }
	},
	testDir: 'e2e',
	projects: [
		{
			name: 'setup',
			testMatch: /program-management\.test\.ts|demo\.test\.ts/,
			use: { ...devices['Desktop Firefox'] }
		},
		{
			name: 'exercise-tests',
			testMatch: /exercise-library\.test\.ts/,
			dependencies: ['setup'],
			use: { ...devices['Desktop Firefox'] }
		},
		{
			name: 'workout-tests',
			testMatch: /workout-flow\.test\.ts/,
			dependencies: ['exercise-tests'],
			use: { ...devices['Desktop Firefox'] }
		}
	]
});

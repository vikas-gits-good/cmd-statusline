import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	webServer: {
		command: 'node e2e/server.mjs',
		port: 4321,
		reuseExistingServer: true,
	},
});

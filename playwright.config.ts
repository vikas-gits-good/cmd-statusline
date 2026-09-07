import {defineConfig} from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	use: {
		baseURL: 'http://localhost:0',
	},
});

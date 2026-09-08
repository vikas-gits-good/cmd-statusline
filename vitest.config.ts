import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/**/*.test.ts'],
		exclude: ['e2e/**', 'node_modules/**'],
		coverage: {
			provider: 'v8',
			include: ['lib.ts', 'usage.ts', 'render.ts'],
			thresholds: {
				lines: 95,
				functions: 95,
				branches: 95,
				statements: 95,
			},
		},
	},
});

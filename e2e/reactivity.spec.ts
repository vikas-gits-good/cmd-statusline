import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('http://localhost:4321/');
});

// These are the closest honest E2E tests for the event-driven reactivity
// decisions: they exercise the same pure helpers index.ts wires to real
// `config_setting_changed` / `session_titled` / git events, and assert a full
// render round-trip through the harness.

test('session rename: fresh disk title wins over cached event title', async ({ page }) => {
	const picked = await page.evaluate(() =>
		window.pickSessionName('Renamed manually', 'Old auto title'),
	);
	expect(picked).toBe('Renamed manually');
});

test('session rename reflects in a rendered status line', async ({ page }) => {
	await page.evaluate(() => {
		window.renderStatus({
			cwd: 'repo',
			branch: 'main',
			dirty: false,
			sessionName: 'Renamed manually',
			model: 'deepseek/deepseek-v4-pro',
			effort: 'high',
			currentTokens: 0,
			contextLimit: 1_000_000,
			usg: 0,
			wkl: 0,
			tot: 0,
			remaining: 10,
			planId: 'individual-go',
		});
	});
	await expect(page.getByTestId('session-name')).toHaveText('Renamed manually');
});

test('model change is classified and renders new model', async ({ page }) => {
	const kind = await page.evaluate(() =>
		window.classifyConfigChange('model', 'anthropic/claude-opus-5'),
	);
	expect(kind).toBe('model');

	await page.evaluate(() => {
		window.renderStatus({
			cwd: 'repo',
			branch: 'main',
			dirty: false,
			sessionName: '',
			model: 'anthropic/claude-opus-5',
			effort: 'high',
			currentTokens: 0,
			contextLimit: 1_000_000,
			usg: 0,
			wkl: 0,
			tot: 0,
			remaining: 10,
			planId: 'individual-go',
		});
	});
	await expect(page.getByTestId('model')).toHaveText('anthropic/claude-opus-5');
});

test('effort change is classified and renders new effort', async ({ page }) => {
	const kind = await page.evaluate(() => window.classifyConfigChange('effort', 'max'));
	expect(kind).toBe('effort');

	await page.evaluate(() => {
		window.renderStatus({
			cwd: 'repo',
			branch: 'main',
			dirty: false,
			sessionName: '',
			model: 'deepseek/deepseek-v4-pro',
			effort: 'max',
			currentTokens: 0,
			contextLimit: 1_000_000,
			usg: 0,
			wkl: 0,
			tot: 0,
			remaining: 10,
			planId: 'individual-go',
		});
	});
	await expect(page.getByTestId('effort')).toHaveText('max');
});

test('unrelated config change is ignored', async ({ page }) => {
	const kind = await page.evaluate(() => window.classifyConfigChange('theme', 'dark'));
	expect(kind).toBeNull();
});

test('detached HEAD is treated as no branch', async ({ page }) => {
	const branch = await page.evaluate(() => window.normalizeBranch('HEAD'));
	expect(branch).toBe('');

	await page.evaluate(() => {
		window.renderStatus({
			cwd: 'repo',
			branch: window.normalizeBranch('HEAD'),
			dirty: false,
			sessionName: '',
			model: 'deepseek/deepseek-v4-pro',
			effort: 'high',
			currentTokens: 0,
			contextLimit: 1_000_000,
			usg: 0,
			wkl: 0,
			tot: 0,
			remaining: 10,
			planId: 'individual-go',
		});
	});
	await expect(page.getByTestId('branch')).toHaveText('');
});

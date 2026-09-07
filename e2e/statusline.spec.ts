import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
	await page.goto('http://localhost:4321/');
});

async function render(page, scenario) {
	await page.evaluate(s => { window.renderStatus(s); }, scenario);
}

// currentTokens/contextLimit drive cntx. 1M context, so 130% cap needs 1.3M tokens.
test('renders a complete status line with all fields', async ({page}) => {
	await render(page, {
		cwd: 'stockup-be',
		branch: 'main',
		dirty: false,
		sessionName: 'System Design Plan',
		model: 'deepseek/deepseek-v4-pro',
		effort: 'high',
		currentTokens: 0,
		contextLimit: 1_000_000,
		usg: 70,
		wkl: 69,
		tot: 85,
		remaining: 11.56,
		planId: 'individual-pro-v1',
	});

	await expect(page.getByTestId('cwd')).toHaveText('stockup-be');
	await expect(page.getByTestId('branch')).toHaveText('main');
	await expect(page.getByTestId('dirty')).toHaveText('clean');
	await expect(page.getByTestId('session-name')).toHaveText('System Design Plan');
	await expect(page.getByTestId('model')).toHaveText('deepseek/deepseek-v4-pro');
	await expect(page.getByTestId('effort')).toHaveText('high');
	await expect(page.getByTestId('cntx')).toHaveText('0');
	await expect(page.getByTestId('usge')).toHaveText('70');
	await expect(page.getByTestId('skly')).toHaveText('69');
	await expect(page.getByTestId('crdt')).toHaveText('11.56');
});

test('shows no session name for a new session', async ({page}) => {
	await render(page, {
		cwd: 'stockup-be',
		branch: 'main',
		dirty: false,
		sessionName: '',
		model: 'deepseek/deepseek-v4-pro',
		effort: 'high',
		currentTokens: 0,
		contextLimit: 1_000_000,
		usg: 70,
		wkl: 69,
		tot: 85,
		remaining: 11.56,
		planId: 'individual-pro-v1',
	});

	await expect(page.getByTestId('session-name')).toHaveText('');
});

test('marks dirty state via git dot', async ({page}) => {
	await render(page, {
		cwd: 'repo',
		branch: 'main',
		dirty: true,
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

	await expect(page.getByTestId('dirty')).toHaveText('dirty');
});

test('caps context usage display at 100%', async ({page}) => {
	await render(page, {
		cwd: 'repo',
		branch: 'main',
		dirty: false,
		model: 'deepseek/deepseek-v4-pro',
		effort: 'high',
		currentTokens: 1_300_000, // 130% → capped at 100%
		contextLimit: 1_000_000,
		usg: 100,
		wkl: 100,
		tot: 100,
		remaining: 0,
		planId: 'individual-go',
	});

	await expect(page.getByTestId('cntx')).toHaveText('100');
	await expect(page.getByTestId('usge')).toHaveText('100');
	await expect(page.getByTestId('skly')).toHaveText('100');
});

test('colors credits red below 10% remaining', async ({page}) => {
	await render(page, {
		cwd: 'repo',
		branch: 'main',
		dirty: false,
		model: 'deepseek/deepseek-v4-pro',
		effort: 'high',
		ctx: 0,
		usg: 0,
		wkl: 0,
		tot: 0,
		remaining: 0.5,
		planId: 'individual-go', // 10 base → 5% remaining → red
	});

	const raw = await page.evaluate(() => window.__lastRawStatusLine);
	expect(raw).toContain('crdt: \u001b[31m$0.50\u001b[0m');
});

test('colors credits orange at 10-24% remaining', async ({page}) => {
	await render(page, {
		cwd: 'repo',
		branch: 'main',
		dirty: false,
		model: 'deepseek/deepseek-v4-pro',
		effort: 'high',
		ctx: 0,
		usg: 0,
		wkl: 0,
		tot: 0,
		remaining: 7,
		planId: 'individual-pro', // 30 base → 23% → orange
	});

	const raw = await page.evaluate(() => window.__lastRawStatusLine);
	expect(raw).toContain('crdt: \u001b[38;5;208m$7.00\u001b[0m');
});

test('colors credits green when healthy', async ({page}) => {
	await render(page, {
		cwd: 'repo',
		branch: 'main',
		dirty: false,
		model: 'deepseek/deepseek-v4-pro',
		effort: 'high',
		ctx: 0,
		usg: 0,
		wkl: 0,
		tot: 0,
		remaining: 29,
		planId: 'individual-pro', // 29/30 = 97%
	});

	const raw = await page.evaluate(() => window.__lastRawStatusLine);
	expect(raw).toContain('crdt: \u001b[32m$29.00\u001b[0m');
});

test('handles unknown model gracefully (no crash, no context)', async ({page}) => {
	await render(page, {
		cwd: 'repo',
		branch: 'main',
		dirty: false,
		model: 'unknown/model',
		effort: 'high',
		ctx: 0,
		usg: 0,
		wkl: 0,
		tot: 0,
		remaining: 10,
		planId: 'individual-go',
	});

	await expect(page.getByTestId('model')).toHaveText('unknown/model');
	await expect(page.getByTestId('cntx')).toHaveText('0');
});

test('handles missing usage data (internal server error scenario)', async ({page}) => {
	await render(page, {
		cwd: 'repo',
		branch: 'main',
		dirty: false,
		model: 'deepseek/deepseek-v4-pro',
		effort: 'high',
		ctx: 0,
		hasUsage: false,
	});

	await expect(page.getByTestId('cwd')).toHaveText('repo');
	await expect(page.getByTestId('model')).toHaveText('deepseek/deepseek-v4-pro');
	await expect(page.getByTestId('usge')).toHaveCount(0);
	await expect(page.getByTestId('crdt')).toHaveCount(0);
});

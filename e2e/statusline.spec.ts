import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
	await page.goto('http://localhost:4321/');
});

test('renders a complete status line with all fields', async ({page}) => {
	const result = await page.evaluate(() => window.renderStatus({
		cwd: 'stockup-be',
		branch: 'main',
		dirty: false,
		sessionName: 'System Design Plan',
		model: 'deepseek/deepseek-v4-pro',
		effort: 'high',
		ctx: 0,
		usg: 70,
		wkl: 69,
		tot: 85,
		remaining: 11.56,
		planId: 'individual-pro-v1',
	}));

	expect(result).toContain('stockup-be, main ');
	expect(result).toContain('System Design Plan');
	expect(result).toContain('deepseek-v4-pro');
	expect(result).toContain('cntx: \u001b[32m0%\u001b[0m');
	expect(result).toContain('usge: \u001b[33m70%\u001b[0m');
	expect(result).toContain('skly: \u001b[33m69%\u001b[0m');
	expect(result).toContain('totl: \u001b[38;5;208m85%\u001b[0m');
	expect(result).toContain('crdt: \u001b[38;5;208m$11.56\u001b[0m');
});

test('shows no session name for a new session', async ({page}) => {
	const result = await page.evaluate(() => window.renderStatus({
		cwd: 'stockup-be',
		branch: 'main',
		dirty: false,
		sessionName: '',
		model: 'deepseek/deepseek-v4-pro',
		effort: 'high',
		ctx: 0,
		usg: 70,
		wkl: 69,
		tot: 85,
		remaining: 11.56,
		planId: 'individual-pro-v1',
	}));

	expect(result).not.toContain(', ,');
	expect(result).toContain('stockup-be, main ');
	expect(result).not.toContain('System Design Plan');
});

test('caps context usage display at 100%', async ({page}) => {
	const result = await page.evaluate(() => window.renderStatus({
		cwd: 'repo',
		branch: 'main',
		dirty: false,
		model: 'deepseek/deepseek-v4-pro',
		effort: 'high',
		ctx: 130,
		usg: 100,
		wkl: 100,
		tot: 100,
		remaining: 0,
		planId: 'individual-go',
	}));

	expect(result).toContain('cntx: \u001b[31m100%\u001b[0m');
	expect(result).toContain('usge: \u001b[31m100%\u001b[0m');
	expect(result).toContain('skly: \u001b[31m100%\u001b[0m');
	expect(result).toContain('totl: \u001b[31m100%\u001b[0m');
});

test('colors credits red below 10% remaining', async ({page}) => {
	const result = await page.evaluate(() => window.renderStatus({
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
	}));
	expect(result).toContain('crdt: \u001b[31m$0.50\u001b[0m');
});

test('colors credits orange at 10-24% remaining', async ({page}) => {
	const result = await page.evaluate(() => window.renderStatus({
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
	}));
	expect(result).toContain('crdt: \u001b[38;5;208m$7.00\u001b[0m');
});

test('colors credits green when healthy', async ({page}) => {
	const result = await page.evaluate(() => window.renderStatus({
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
	}));
	expect(result).toContain('crdt: \u001b[32m$29.00\u001b[0m');
});

test('handles unknown model gracefully (no crash, no context)', async ({page}) => {
	const result = await page.evaluate(() => window.renderStatus({
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
	}));
	expect(result).toContain('unknown');
	expect(result).toContain('cntx: \u001b[32m0%\u001b[0m');
});

test('handles missing usage data (internal server error scenario)', async ({page}) => {
	// When the API returns nothing, usage fields should be absent but the line still renders.
	const result = await page.evaluate(() => window.renderStatus({
		cwd: 'repo',
		branch: 'main',
		dirty: false,
		model: 'deepseek/deepseek-v4-pro',
		effort: 'high',
		ctx: 0,
		hasUsage: false,
	}));
	expect(result).toContain('repo, main');
	expect(result).toContain('deepseek-v4-pro');
	expect(result).not.toContain('usge:');
	expect(result).not.toContain('crdt:');
});

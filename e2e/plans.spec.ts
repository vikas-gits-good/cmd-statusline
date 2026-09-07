import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface PlanEntry {
	id: string;
	name: string;
	monthlyCredits: number;
}

const plans: PlanEntry[] = JSON.parse(
	readFileSync(join(process.cwd(), 'e2e', 'plans.list.json'), 'utf8'),
).plans;

test.beforeEach(async ({ page }) => {
	await page.goto('http://localhost:4321/');
});

async function renderCredits(page, planId: string, remaining: number) {
	await page.evaluate(
		({ planId, remaining }) => {
			window.renderStatus({
				cwd: 'repo',
				branch: 'main',
				dirty: false,
				model: 'deepseek/deepseek-v4-pro',
				effort: 'high',
				currentTokens: 0,
				contextLimit: 1_000_000,
				usg: 0,
				wkl: 0,
				tot: 0,
				remaining,
				planId,
			});
		},
		{ planId, remaining },
	);
}

for (const plan of plans) {
	test(`${plan.name} (${plan.id}): 100% remaining is green`, async ({ page }) => {
		await renderCredits(page, plan.id, plan.monthlyCredits);
		const raw = await page.evaluate(() => window.__lastRawStatusLine);
		expect(raw).toContain('crdt: \u001b[32m$' + plan.monthlyCredits.toFixed(2) + '\u001b[0m');
	});

	test(`${plan.name} (${plan.id}): 9% remaining is red`, async ({ page }) => {
		await renderCredits(page, plan.id, plan.monthlyCredits * 0.09);
		const raw = await page.evaluate(() => window.__lastRawStatusLine);
		expect(raw).toContain('crdt: \u001b[31m');
	});

	test(`${plan.name} (${plan.id}): 24% remaining is orange`, async ({ page }) => {
		await renderCredits(page, plan.id, plan.monthlyCredits * 0.24);
		const raw = await page.evaluate(() => window.__lastRawStatusLine);
		expect(raw).toContain('crdt: \u001b[38;5;208m');
	});

	test(`${plan.name} (${plan.id}): 49% remaining is yellow`, async ({ page }) => {
		await renderCredits(page, plan.id, plan.monthlyCredits * 0.49);
		const raw = await page.evaluate(() => window.__lastRawStatusLine);
		expect(raw).toContain('crdt: \u001b[33m');
	});
}

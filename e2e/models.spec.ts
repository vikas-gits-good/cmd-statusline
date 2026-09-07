import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const list = JSON.parse(readFileSync(join(process.cwd(), 'e2e', 'models.list.json'), 'utf8')) as {
	models: string[];
};

test.beforeEach(async ({ page }) => {
	await page.goto('http://localhost:4321/');
});

// Every model in the synced catalog gets a render smoke test that exercises
// resolveContextWindow for THAT model — not a hardcoded 1M limit. Models whose
// context window is genuinely absent from the CLI's own Tr map are skipped
// explicitly (the mod renders them as "--" by design, which is correct).
const KNOWN_MISSING = new Set([
	'zai-org/glm-5.1',
	'minimaxai/minimax-m2.7',
	'qwen/qwen3.6-max-preview',
	'qwen/qwen3.6-plus',
	'claude-haiku-4-5',
]);

for (const model of list.models) {
	// These five are absent from the CLI's own Tr map; the mod correctly
	// renders their cntx as "--". Skip rather than fail on CLI data gaps.
	const knownMissing = KNOWN_MISSING.has(model);
	test(`renders ${model} with a real context window`, async ({ page }) => {
		test.skip(knownMissing, `model "${model}" has no context window in the CLI's own map`);

		const contextLimit = await page.evaluate((m) => {
			const w = window.resolveContextWindow(m, window.CONTEXT_WINDOWS);
			return w ?? null;
		}, model);

		// Fail loudly if a non-expected model is unknown — this catches drift.
		expect(
			contextLimit,
			`model "${model}" has no context window in CONTEXT_WINDOWS`,
		).not.toBeNull();

		await page.evaluate(
			({ m, limit }) => {
				window.renderStatus({
					cwd: 'repo',
					branch: 'main',
					dirty: false,
					sessionName: '',
					model: m,
					effort: 'high',
					currentTokens: Math.round(limit / 2),
					contextLimit: limit,
					usg: 0,
					wkl: 0,
					tot: 0,
					remaining: 10,
					planId: 'individual-go',
				});
			},
			{ m: model, limit: contextLimit },
		);

		await expect(page.getByTestId('model')).toHaveText(model);
		await expect(page.getByTestId('cntx')).toHaveText('50');
	});
}

import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const list = JSON.parse(readFileSync(join(process.cwd(), 'e2e', 'models.list.json'), 'utf8')) as {
	models: string[];
};

test.beforeEach(async ({page}) => {
	await page.goto('http://localhost:4321/');
});

// Every model in the synced catalog gets a render smoke test. The sync script
// (e2e/sync-models.mjs) refreshes this list before the run, so new models
// are covered automatically.
for (const model of list.models) {
	test(`renders ${model} with a non-zero context`, async ({page}) => {
		await page.evaluate(m => {
			window.renderStatus({
				cwd: 'repo',
				branch: 'main',
				dirty: false,
				sessionName: '',
				model: m,
				effort: 'high',
				currentTokens: 500_000,
				contextLimit: 1_000_000,
				usg: 0,
				wkl: 0,
				tot: 0,
				remaining: 10,
				planId: 'individual-go',
			});
		}, model);

		await expect(page.getByTestId('model')).toHaveText(model);
		await expect(page.getByTestId('cntx')).toHaveText('50');
	});
}

import {test, expect} from '@playwright/test';

const MODELS = [
	'deepseek/deepseek-v4-pro',
	'deepseek/deepseek-v4-flash',
	'deepseek/deepseek-v4-flash-vision-exp',
	'deepseek/deepseek-v4-flash-fast',
	'anthropic/claude-sonnet-5',
	'anthropic/claude-sonnet-4-6',
	'anthropic/claude-fable-5-1',
	'anthropic/claude-fable-5',
	'anthropic/claude-opus-5',
	'anthropic/claude-opus-4-8',
	'anthropic/claude-opus-4-7',
];

test.beforeEach(async ({page}) => {
	await page.goto('http://localhost:4321/');
});

for (const model of MODELS) {
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

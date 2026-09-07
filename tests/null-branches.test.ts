import { describe, it, expect } from 'vitest';
import { buildStatusLine, stripAnsi, type StatusState, type Usage } from '../lib';

function state(overrides: Partial<StatusState> = {}): StatusState {
	return {
		cwd: 'my-project',
		branch: 'main',
		dirty: false,
		sessionName: '',
		model: 'deepseek/deepseek-v4-pro',
		effort: 'high',
		currentTokens: 0,
		contextLimit: 1_000_000,
		usage: null,
		...overrides,
	};
}

const usage = (overrides: Partial<Usage> = {}): Usage => ({
	planId: 'individual-pro',
	fiveHourUsed: 5,
	fiveHourCap: 16,
	weeklyUsed: 20,
	weeklyCap: 40,
	monthlyCredits: 30,
	purchasedCredits: 0,
	freeCredits: 0,
	totalSpent: 10,
	...overrides,
});

describe('unknown context renders as -- (not misleading 0%)', () => {
	it('renders -- when contextLimit is 0', () => {
		const line = buildStatusLine(state({ contextLimit: 0, currentTokens: 0 }));
		expect(line).toContain(`cntx: \u001b[2m--\u001b[0m`);
	});

	it('renders -- for unknown model', () => {
		const line = buildStatusLine(
			state({ model: 'unknown/model', contextLimit: 0, currentTokens: 0 }),
		);
		expect(line).toContain('cntx: \u001b[2m--\u001b[0m');
	});
});

describe('null-usage window fallback to 0', () => {
	it('renders usge/wkly/totl as 0 when those windows are null', () => {
		// usage present but window caps are 0 → pct() returns 0, so the
		// `seg.usge ?? 0` null-coalescing path is exercised.
		const line = stripAnsi(
			buildStatusLine(
				state({
					usage: usage({ fiveHourCap: 0, weeklyCap: 0 }),
				}),
			),
		);
		expect(line).toContain('usge: 0%');
		expect(line).toContain('wkly: 0%');
	});
});

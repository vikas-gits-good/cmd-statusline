import { describe, it, expect } from 'vitest';
import { buildStatusLine, type StatusState, type Usage } from './lib';

function baseState(overrides: Partial<StatusState> = {}): StatusState {
	return {
		cwd: 'repo',
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
	planId: 'individual-pro-v1',
	fiveHourUsed: 5,
	fiveHourCap: 16,
	weeklyUsed: 20,
	weeklyCap: 40,
	monthlyCredits: 40,
	purchasedCredits: 0,
	freeCredits: 0,
	totalSpent: 30,
	...overrides,
});

describe('buildStatusLine reactivity (fresh state → updated output)', () => {
	it('reflects a changed session name', () => {
		const before = buildStatusLine(baseState({ sessionName: 'Old' }));
		const after = buildStatusLine(baseState({ sessionName: 'New' }));
		expect(before).toContain('Old');
		expect(after).toContain('New');
		expect(after).not.toContain('Old');
	});

	it('reflects a changed branch', () => {
		const before = buildStatusLine(baseState({ branch: 'main' }));
		const after = buildStatusLine(baseState({ branch: 'feat/x' }));
		expect(before).toContain('main');
		expect(after).toContain('feat/x');
	});

	it('reflects dirty vs clean git state', () => {
		const clean = buildStatusLine(baseState({ dirty: false }));
		const dirty = buildStatusLine(baseState({ dirty: true }));
		expect(clean).toContain('\x1b[32m●\x1b[0m');
		expect(dirty).toContain('\x1b[38;5;208m●\x1b[0m');
	});

	it('reflects a changed model', () => {
		const before = buildStatusLine(baseState({ model: 'deepseek/deepseek-v4-pro' }));
		const after = buildStatusLine(baseState({ model: 'anthropic/claude-opus-5' }));
		expect(before).toContain('deepseek-v4-pro');
		expect(after).toContain('claude-opus-5');
	});

	it('reflects changed context tokens', () => {
		const before = buildStatusLine(baseState({ currentTokens: 0, contextLimit: 1_000_000 }));
		const after = buildStatusLine(baseState({ currentTokens: 500_000, contextLimit: 1_000_000 }));
		expect(before).toContain('cntx: \x1b[32m0%\x1b[0m');
		expect(after).toContain('cntx: \x1b[33m50%\x1b[0m');
	});

	it('reflects changed usage numbers', () => {
		const before = buildStatusLine(baseState({ usage: usage({ fiveHourUsed: 5 }) }));
		const after = buildStatusLine(baseState({ usage: usage({ fiveHourUsed: 15 }) }));
		expect(before).toContain('usge: \x1b[32m31%\x1b[0m');
		// 15/16 = 93.75% → 94% → red (≥90)
		expect(after).toContain('usge: \x1b[31m94%\x1b[0m');
	});

	it('drops usage fields when usage is null (API failure)', () => {
		const line = buildStatusLine(baseState({ usage: null }));
		expect(line).not.toContain('usge:');
		expect(line).not.toContain('crdt:');
	});

	it('renders empty session name cleanly', () => {
		const line = buildStatusLine(baseState({ sessionName: '' }));
		expect(line).toContain('repo, main');
		expect(line).not.toContain(', ,');
	});
});

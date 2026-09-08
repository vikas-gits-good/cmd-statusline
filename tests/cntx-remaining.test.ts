import { describe, it, expect } from 'vitest';
import { computeStatus, type StatusState } from '../lib';

function state(overrides: Partial<StatusState> = {}): StatusState {
	return {
		cwd: 'my-project',
		branch: 'main',
		dirty: false,
		sessionName: '',
		model: 'deepseek/deepseek-v4-pro',
		effort: 'high',
		currentTokens: 500_000,
		contextLimit: 1_000_000,
		usage: null,
		...overrides,
	};
}

describe('computeStatus.cntxRemaining', () => {
	it('returns 50 when used is 50', () => {
		expect(
			computeStatus(state({ currentTokens: 500_000, contextLimit: 1_000_000 })).cntxRemaining,
		).toBe(50);
	});

	it('returns null when cntx is null (unknown context window)', () => {
		expect(computeStatus(state({ contextLimit: 0 })).cntxRemaining).toBeNull();
	});

	it('returns 0 when used is 100', () => {
		expect(
			computeStatus(state({ currentTokens: 1_000_000, contextLimit: 1_000_000 })).cntxRemaining,
		).toBe(0);
	});

	it('returns 100 when used is 0', () => {
		expect(computeStatus(state({ currentTokens: 0, contextLimit: 1_000_000 })).cntxRemaining).toBe(
			100,
		);
	});

	it('clamps negative tokens to 100 remaining', () => {
		expect(
			computeStatus(state({ currentTokens: -100, contextLimit: 1_000_000 })).cntxRemaining,
		).toBe(100);
	});

	it('clamps over-limit tokens to 0 remaining', () => {
		expect(
			computeStatus(state({ currentTokens: 1_500_000, contextLimit: 1_000_000 })).cntxRemaining,
		).toBe(0);
	});
});

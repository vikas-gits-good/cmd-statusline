import { describe, it, expect } from 'vitest';
import { buildStatusInput, type StatusState } from '../lib';

function state(overrides: Partial<StatusState> = {}): StatusState {
	return {
		cwd: 'repo',
		branch: 'main',
		dirty: false,
		sessionName: 'My Session',
		model: 'deepseek/deepseek-v4-pro',
		effort: 'high',
		currentTokens: 500_000,
		contextLimit: 1_000_000,
		usage: {
			planId: 'individual-pro',
			fiveHourUsed: 5,
			fiveHourCap: 16,
			weeklyUsed: 20,
			weeklyCap: 40,
			monthlyCredits: 30,
			purchasedCredits: 0,
			freeCredits: 0,
			totalSpent: 15,
		},
		...overrides,
	};
}

describe('buildStatusInput (rich typed contract)', () => {
	it('populates session fields', () => {
		const inp = buildStatusInput(state(), {
			sessionId: 'abc-123',
			transcriptPath: '/tmp/t.jsonl',
		});
		expect(inp.session_id).toBe('abc-123');
		expect(inp.transcript_path).toBe('/tmp/t.jsonl');
		expect(inp.session_name).toBe('My Session');
	});

	it('populates model fields', () => {
		const inp = buildStatusInput(state());
		expect(inp.model.id).toBe('deepseek/deepseek-v4-pro');
		expect(inp.model.display_name).toBe('deepseek-v4-pro');
	});

	it('populates workspace fields', () => {
		const inp = buildStatusInput(state());
		expect(inp.workspace.current_dir).toBe('repo');
	});

	it('populates context window fields with clamped percentages', () => {
		const inp = buildStatusInput(state());
		expect(inp.context_window.context_window_size).toBe(1_000_000);
		expect(inp.context_window.used_percentage).toBe(50);
		expect(inp.context_window.remaining_percentage).toBe(50);
	});

	it('populates rate limits when usage is present', () => {
		const inp = buildStatusInput(state());
		expect(inp.rate_limits.five_hour!.used_percentage).toBeCloseTo(31.25);
		expect(inp.rate_limits.weekly!.used_percentage).toBe(50);
	});

	it('leaves rate_limits null when usage is absent', () => {
		const inp = buildStatusInput(state({ usage: null }));
		expect(inp.rate_limits.five_hour).toBeNull();
		expect(inp.rate_limits.weekly).toBeNull();
		// context window is independent of usage, so still computed.
		expect(inp.context_window.used_percentage).toBe(50);
	});

	it('handles unknown model context window as null', () => {
		const inp = buildStatusInput(state({ model: 'unknown/model', contextLimit: 0 }));
		expect(inp.context_window.used_percentage).toBeNull();
	});
});

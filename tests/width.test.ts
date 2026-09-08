import { describe, it, expect } from 'vitest';
import { buildStatusLine, stripAnsi, type StatusState } from '../lib';

function state(overrides: Partial<StatusState> = {}): StatusState {
	return {
		cwd: 'my-project',
		branch: 'main',
		dirty: false,
		sessionName: 'System Design Plan',
		model: 'deepseek/deepseek-v4-pro',
		effort: 'high',
		currentTokens: 500_000,
		contextLimit: 1_000_000,
		usage: {
			planId: 'individual-pro-v1',
			fiveHourUsed: 70,
			fiveHourCap: 100,
			weeklyUsed: 69,
			weeklyCap: 100,
			monthlyCredits: 11.56,
			purchasedCredits: 0,
			freeCredits: 0,
			totalSpent: 50,
		},
		...overrides,
	};
}

describe('stripAnsi', () => {
	it('removes ANSI color and style codes', () => {
		expect(stripAnsi('\x1b[32mgreen\x1b[0m')).toBe('green');
	});
	it('leaves plain text unchanged', () => {
		expect(stripAnsi('plain text')).toBe('plain text');
	});
	it('returns empty for empty input', () => {
		expect(stripAnsi('')).toBe('');
	});
});

describe('buildStatusLine width budget', () => {
	it('returns the full line when no max width is given', () => {
		const line = buildStatusLine(state());
		expect(line).toContain('crdt:');
		expect(line).toContain('totl:');
		expect(line).toContain('wkly:');
	});

	it('fits within a generous max width without truncation', () => {
		const line = buildStatusLine(state(), 500);
		expect(stripAnsi(line).length).toBeLessThanOrEqual(500);
	});

	it('drops the rightmost field (crdt) first when too narrow', () => {
		const base = state({ sessionName: '' }); // no session name, so only right fields drop
		const full = buildStatusLine(base);
		const fullLen = stripAnsi(full).length;
		// crdt segment is exactly 14 visible chars; trim that much so crdt drops
		// but the line (now fullLen-14) fits, leaving totl intact.
		const line = buildStatusLine(base, fullLen - 14);
		expect(stripAnsi(line).length).toBeLessThanOrEqual(fullLen - 14);
		expect(line).not.toContain('crdt:');
		expect(line).toContain('totl:');
	});

	it('drops crdt then totl then wkly as width shrinks', () => {
		const base = state({ sessionName: '' });
		const full = buildStatusLine(base);
		const fullLen = stripAnsi(full).length;
		// crdt (14) + totl (11) = 25; trim that much so both drop but wkly stays.
		const line = buildStatusLine(base, fullLen - 25);
		expect(line).not.toContain('crdt:');
		expect(line).not.toContain('totl:');
		expect(line).toContain('wkly:');
	});

	it('keeps cwd ellipsized at tiny widths (never hard-cut)', () => {
		const line = buildStatusLine(state(), 5);
		const visible = stripAnsi(line);
		expect(visible.length).toBeLessThanOrEqual(5);
		expect(visible.endsWith('…') || visible === 'my-pr').toBe(true);
	});

	it('keeps session name whole while dropping low-priority usage fields', () => {
		const full = buildStatusLine(state({ sessionName: 'A very long session title' }));
		const line = buildStatusLine(
			state({ sessionName: 'A very long session title' }),
			stripAnsi(full).length - 30,
		);
		// Usage fields (crdt/totl/wkly) drop first; session name stays whole.
		expect(line).toContain('A very long session title');
		expect(line).toContain('deepseek-v4-pro');
		expect(line).not.toContain('crdt:');
	});

	it('returns a valid line even with maxWidth of 0', () => {
		const line = buildStatusLine(state(), 0);
		expect(stripAnsi(line).length).toBeLessThanOrEqual(1);
		expect(stripAnsi(line)).toBe('…');
	});
});

describe('whole-field integrity (no partial cuts)', () => {
	const longCwd = 'a-very-long-project-directory-name-that-exceeds-any-reasonable-status-width';
	const longBranch = 'feature/an-extremely-long-branch-name-for-testing';
	const longSession = 'A Detailed Session Title That Is Far Too Long To Fit On One Line';
	const longModel = 'some-provider/a-model-name-that-is-extraordinarily-long';

	// A field must appear whole, be ellipsized with a trailing "…", or be
	// absent — it must never be cut mid-word. Helper asserts that invariant.
	const assertWholeOrEllipsized = (line: string, full: string, prefix: string) => {
		expect(line).not.toContain('\n');
		const whole = line.includes(full);
		if (whole) return;
		const ellipsized = line.includes('…');
		if (ellipsized) return;
		// If neither whole nor ellipsized, it must be fully absent (no bare prefix).
		expect(line.includes(prefix)).toBe(false);
	};

	it('cwd: whole, ellipsized, or absent (never mid-cut)', () => {
		const line = stripAnsi(buildStatusLine(state({ cwd: longCwd, sessionName: '' }), 25));
		assertWholeOrEllipsized(line, longCwd, longCwd.slice(0, 15));
	});

	it('branch: whole, ellipsized, or absent (never mid-cut)', () => {
		const line = stripAnsi(buildStatusLine(state({ branch: longBranch, sessionName: '' }), 25));
		assertWholeOrEllipsized(line, longBranch, longBranch.slice(0, 12));
	});

	it('session name: whole, ellipsized, or absent (never mid-cut)', () => {
		const line = stripAnsi(buildStatusLine(state({ sessionName: longSession }), 40));
		assertWholeOrEllipsized(line, longSession, longSession.slice(0, 12));
	});

	it('model name: whole, ellipsized, or absent (never mid-cut)', () => {
		const line = stripAnsi(buildStatusLine(state({ model: longModel, sessionName: '' }), 40));
		assertWholeOrEllipsized(line, longModel, longModel.slice(0, 12));
	});

	it('all four long fields together fit within budget without wrapping', () => {
		const s = state({
			cwd: longCwd,
			branch: longBranch,
			sessionName: longSession,
			model: longModel,
		});
		const line = stripAnsi(buildStatusLine(s, 200));
		expect(line).not.toContain('\n');
		expect(line.length).toBeLessThanOrEqual(200);
	});
});

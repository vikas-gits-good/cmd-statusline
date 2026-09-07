import { describe, it, expect } from 'vitest';
import {
	renderTemplate,
	DEFAULT_TEMPLATE,
	buildStatusLine,
	stripAnsi,
	type StatusState,
} from '../lib';

function state(overrides: Partial<StatusState> = {}): StatusState {
	return {
		cwd: 'my-project',
		branch: 'main',
		dirty: false,
		sessionName: 'A Session',
		model: 'deepseek/deepseek-v4-pro',
		effort: 'high',
		currentTokens: 500_000,
		contextLimit: 1_000_000,
		usage: {
			planId: 'individual-pro',
			fiveHourUsed: 50,
			fiveHourCap: 100,
			weeklyUsed: 40,
			weeklyCap: 100,
			monthlyCredits: 30,
			purchasedCredits: 0,
			freeCredits: 0,
			totalSpent: 15,
		},
		...overrides,
	};
}

describe('renderTemplate', () => {
	it('default template reproduces the current buildStatusLine output', () => {
		expect(renderTemplate(DEFAULT_TEMPLATE, state())).toBe(buildStatusLine(state()));
	});

	it('custom template reorders and drops fields', () => {
		const out = renderTemplate('{model} / {cwd} / {effort}', state());
		expect(out).toContain('deepseek-v4-pro');
		expect(out).toContain('my-project');
		expect(out).toContain('high');
		expect(out).not.toContain('usge');
	});

	it('leaves unknown tokens verbatim', () => {
		expect(renderTemplate('{cwd} {unknown}', state())).toBe('my-project {unknown}');
	});

	it('does not re-interpolate a value containing {model}', () => {
		const s = state({ sessionName: 'fix {model} bug' });
		const out = renderTemplate('{cwd}, {session}', s);
		expect(out).toBe('my-project, fix {model} bug');
	});

	it('does not re-interpolate a value containing $&', () => {
		const s = state({ cwd: 'a$&b' });
		expect(renderTemplate('{cwd}', s)).toBe('a$&b');
	});

	it('renders -- for null usage tokens when usage is null', () => {
		const s = state({ usage: null });
		const out = stripAnsi(renderTemplate('{usge} {wkly} {totl} {crdt}', s));
		expect(out).toBe('-- -- -- --');
	});

	it('respects maxWidth by ellipsizing the whole line without partial cut', () => {
		const out = renderTemplate('{cwd}, {branch}, {session}', state(), 10);
		expect(stripAnsi(out).length).toBeLessThanOrEqual(10);
		expect(stripAnsi(out).endsWith('…')).toBe(true);
	});
});

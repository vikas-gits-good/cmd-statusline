import {describe, it, expect} from 'vitest';
import {
	CONTEXT_WINDOWS,
	resolveContextWindow,
	shortModelName,
	buildStatusLine,
	type StatusState,
} from './lib';

// Every model in the registry, expressed as full "provider/model" slugs the
// API actually returns, mapped to the short name the status line displays.
const MODELS: Array<{full: string; short: string}> = [
	{full: 'deepseek/deepseek-v4-pro', short: 'deepseek-v4-pro'},
	{full: 'deepseek/deepseek-v4-flash', short: 'deepseek-v4-flash'},
	{full: 'deepseek/deepseek-v4-flash-vision-exp', short: 'deepseek-v4-flash-vision-exp'},
	{full: 'deepseek/deepseek-v4-flash-fast', short: 'deepseek-v4-flash-fast'},
	{full: 'anthropic/claude-sonnet-5', short: 'claude-sonnet-5'},
	{full: 'anthropic/claude-sonnet-4-6', short: 'claude-sonnet-4-6'},
	{full: 'anthropic/claude-fable-5-1', short: 'claude-fable-5-1'},
	{full: 'anthropic/claude-fable-5', short: 'claude-fable-5'},
	{full: 'anthropic/claude-opus-5', short: 'claude-opus-5'},
	{full: 'anthropic/claude-opus-4-8', short: 'claude-opus-4-8'},
	{full: 'anthropic/claude-opus-4-7', short: 'claude-opus-4-7'},
];

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

describe('every registered model', () => {
	it('covers the same set as CONTEXT_WINDOWS', () => {
		const registered = Object.keys(CONTEXT_WINDOWS).sort();
		const tested = MODELS.map(m => m.short).sort();
		expect(tested).toEqual(registered);
	});

	it.each(MODELS)('resolves a context window for $full', ({full, short}) => {
		const w = resolveContextWindow(full);
		expect(w).toBe(CONTEXT_WINDOWS[short]);
		expect(w).toBeGreaterThan(0);
	});

	it.each(MODELS)('shortens $full to $short', ({full, short}) => {
		expect(shortModelName(full)).toBe(short);
	});

	it.each(MODELS)('renders $short in the status line with a non-zero context', ({full, short}) => {
		const limit = resolveContextWindow(full)!;
		const line = buildStatusLine(baseState({
			model: full,
			currentTokens: limit / 2, // 50% fill
			contextLimit: limit,
		}));
		expect(line).toContain(short);
		expect(line).toContain('cntx: \u001b[33m50%\u001b[0m');
	});

	it.each(MODELS)('renders $short even when context tokens are zero', ({full, short}) => {
		const limit = resolveContextWindow(full)!;
		const line = buildStatusLine(baseState({model: full, contextLimit: limit}));
		expect(line).toContain(short);
		expect(line).toContain('cntx: \u001b[32m0%\u001b[0m');
	});
});

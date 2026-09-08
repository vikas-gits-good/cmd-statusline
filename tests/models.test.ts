import { describe, it, expect } from 'vitest';
import { CONTEXT_WINDOWS, resolveContextWindow, buildStatusLine, type StatusState } from '../lib';

// The context-window map is the authoritative source for the mod's own
// rendering. The sync-generated e2e/context-windows.json is validated by the
// E2E suite (which runs sync first); unit tests derive from lib.ts directly so
// they never depend on a generated file.
const modelIds = Object.keys(CONTEXT_WINDOWS);

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

describe('every model in CONTEXT_WINDOWS', () => {
	it('resolves a context window for each model id', () => {
		for (const id of modelIds) {
			expect(resolveContextWindow(id)).toBe(CONTEXT_WINDOWS[id]);
			expect(resolveContextWindow(id)).toBeGreaterThan(0);
		}
	});

	it.each(modelIds)('renders %s with a non-zero context', (id) => {
		const limit = CONTEXT_WINDOWS[id];
		const line = buildStatusLine(
			baseState({ model: id, currentTokens: limit / 2, contextLimit: limit }),
		);
		expect(line).toContain('cntx: \u001b[33m50%\u001b[0m');
	});

	it.each(modelIds)('renders %s with zero context tokens', (id) => {
		const line = buildStatusLine(baseState({ model: id, contextLimit: CONTEXT_WINDOWS[id] }));
		expect(line).toContain('cntx: \u001b[32m0%\u001b[0m');
	});
});

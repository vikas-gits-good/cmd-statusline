import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {CONTEXT_WINDOWS, resolveContextWindow, shortModelName, buildStatusLine, type StatusState} from './lib';

// The authoritative context-window map synced from the installed CLI.
const windows: Record<string, number> = JSON.parse(
	readFileSync(join(process.cwd(), 'e2e', 'context-windows.json'), 'utf8'),
).windows;

const modelIds = Object.keys(windows);

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

describe('every model in the synced context-window map', () => {
	it('CONTEXT_WINDOWS matches the synced map', () => {
		expect(Object.keys(CONTEXT_WINDOWS).sort()).toEqual(modelIds.sort());
	});

	it.each(modelIds)('resolves a context window for %s', id => {
		const w = resolveContextWindow(id);
		expect(w).toBe(windows[id]);
		expect(w).toBeGreaterThan(0);
	});

	it.each(modelIds)('renders %s with a non-zero context', id => {
		const limit = windows[id];
		const line = buildStatusLine(baseState({model: id, currentTokens: limit / 2, contextLimit: limit}));
		expect(line).toContain('cntx: \u001b[33m50%\u001b[0m');
	});

	it.each(modelIds)('renders %s with zero context tokens', id => {
		const line = buildStatusLine(baseState({model: id, contextLimit: windows[id]}));
		expect(line).toContain('cntx: \u001b[32m0%\u001b[0m');
	});
});

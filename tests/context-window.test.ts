import { describe, it, expect } from 'vitest';
import { resolveContextWindow, DEFAULT_CONTEXT_WINDOW, CONTEXT_WINDOWS } from '../lib';

describe('resolveContextWindow precedence + opt-in fallback', () => {
	it('env override wins over the map', () => {
		expect(
			resolveContextWindow('deepseek/deepseek-v4-pro', CONTEXT_WINDOWS, { envOverride: 1234 }),
		).toBe(1234);
	});

	it('invalid env override is ignored', () => {
		expect(
			resolveContextWindow('deepseek/deepseek-v4-pro', CONTEXT_WINDOWS, { envOverride: 0 }),
		).toBe(CONTEXT_WINDOWS['deepseek/deepseek-v4-pro']);
		expect(
			resolveContextWindow('deepseek/deepseek-v4-pro', CONTEXT_WINDOWS, { envOverride: -5 }),
		).toBe(CONTEXT_WINDOWS['deepseek/deepseek-v4-pro']);
	});

	it('known model resolves case-insensitively', () => {
		expect(resolveContextWindow('DEEPSEEK/DEEPSEEK-V4-PRO', CONTEXT_WINDOWS)).toBe(1_000_000);
	});

	it('unknown model returns undefined by default', () => {
		expect(resolveContextWindow('unknown/model', CONTEXT_WINDOWS)).toBeUndefined();
	});

	it('unknown model returns DEFAULT_CONTEXT_WINDOW when opts.fallback is set', () => {
		expect(resolveContextWindow('unknown/model', CONTEXT_WINDOWS, { fallback: true })).toBe(
			DEFAULT_CONTEXT_WINDOW,
		);
	});

	it('empty model returns undefined by default', () => {
		expect(resolveContextWindow('', CONTEXT_WINDOWS)).toBeUndefined();
	});
});

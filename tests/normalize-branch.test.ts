import { describe, it, expect } from 'vitest';
import { normalizeBranch } from '../lib';

describe('normalizeBranch', () => {
	it('returns a normal branch name unchanged', () => {
		expect(normalizeBranch('main')).toBe('main');
		expect(normalizeBranch('vks/1-used-remaining-context')).toBe('vks/1-used-remaining-context');
	});

	it('trims surrounding whitespace', () => {
		expect(normalizeBranch('  feature/x  ')).toBe('feature/x');
	});

	it('returns empty string for detached HEAD', () => {
		expect(normalizeBranch('HEAD')).toBe('');
	});

	it('returns empty string for whitespace-only HEAD', () => {
		expect(normalizeBranch('  HEAD  ')).toBe('');
	});

	it('does not treat a branch named head-like as detached', () => {
		expect(normalizeBranch('feature/head')).toBe('feature/head');
	});
});

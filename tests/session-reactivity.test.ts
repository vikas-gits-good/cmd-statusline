import { describe, it, expect } from 'vitest';
import { pickSessionName, normalizeBranch } from '../lib';

describe('pickSessionName (rename/cwd reactivity)', () => {
	it('prefers the fresh disk name over the cached event name (manual /rename)', () => {
		// disk has the new manual rename; event still has the old auto-title.
		expect(pickSessionName('Renamed manually', 'Old auto title')).toBe('Renamed manually');
	});

	it('falls back to the event name when disk is empty (brand-new session)', () => {
		expect(pickSessionName('', 'Auto title')).toBe('Auto title');
	});

	it('trims whitespace from both inputs', () => {
		expect(pickSessionName('  Disk  ', '  Event  ')).toBe('Disk');
		expect(pickSessionName('  ', '  Event  ')).toBe('Event');
	});

	it('returns empty when both are empty', () => {
		expect(pickSessionName('', '')).toBe('');
	});
});

describe('normalizeBranch (cwd-change / detached HEAD reactivity)', () => {
	it('preserves a real branch name after a cwd change', () => {
		// After `cd` into another repo, git reports that repo's branch.
		expect(normalizeBranch('feat/other-repo')).toBe('feat/other-repo');
	});

	it('returns empty for detached HEAD', () => {
		expect(normalizeBranch('HEAD')).toBe('');
	});
});

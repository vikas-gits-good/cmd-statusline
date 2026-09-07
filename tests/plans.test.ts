import { describe, it, expect } from 'vitest';
import { colorCredits, PLAN_CREDITS } from '../lib';

// The plan→credits map in lib.ts is the mod's own source of truth. The
// sync-generated e2e/plans.list.json is validated by the E2E suite (which runs
// sync first); unit tests derive from PLAN_CREDITS directly so they never
// depend on a generated file.
const plans = Object.entries(PLAN_CREDITS)
	.map(([id, monthlyCredits]) => ({ id, name: id, monthlyCredits }))
	.sort((a, b) => a.id.localeCompare(b.id));

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const ORANGE = '\x1b[38;5;208m';
const RED = '\x1b[31m';

describe('all Command Code plans (credit color coding)', () => {
	it('has every known plan', () => {
		expect(Object.keys(PLAN_CREDITS)).toContain('individual-go');
		expect(Object.keys(PLAN_CREDITS)).toContain('individual-goat');
		expect(Object.keys(PLAN_CREDITS)).toContain('individual-pro');
		expect(Object.keys(PLAN_CREDITS)).toContain('individual-pro-v1');
		expect(Object.keys(PLAN_CREDITS)).toContain('individual-provider');
		expect(Object.keys(PLAN_CREDITS)).toContain('individual-max');
		expect(Object.keys(PLAN_CREDITS)).toContain('individual-ultra');
		expect(Object.keys(PLAN_CREDITS)).toContain('teams-pro');
	});

	it.each(plans)('$id has positive credits', ({ monthlyCredits }) => {
		expect(monthlyCredits).toBeGreaterThan(0);
	});

	it.each(plans)('$id: 100%% remaining is green', ({ id, monthlyCredits }) => {
		expect(colorCredits(monthlyCredits, id)).toContain(GREEN);
	});

	it.each(plans)('$id: 50%% remaining is green (boundary)', ({ id, monthlyCredits }) => {
		expect(colorCredits(monthlyCredits * 0.5, id)).toContain(GREEN);
	});

	it.each(plans)('$id: 49%% remaining is yellow', ({ id, monthlyCredits }) => {
		expect(colorCredits(monthlyCredits * 0.49, id)).toContain(YELLOW);
	});

	it.each(plans)('$id: 25%% remaining is yellow (boundary)', ({ id, monthlyCredits }) => {
		expect(colorCredits(monthlyCredits * 0.25, id)).toContain(YELLOW);
	});

	it.each(plans)('$id: 24%% remaining is orange', ({ id, monthlyCredits }) => {
		expect(colorCredits(monthlyCredits * 0.24, id)).toContain(ORANGE);
	});

	it.each(plans)('$id: 10%% remaining is orange (boundary)', ({ id, monthlyCredits }) => {
		expect(colorCredits(monthlyCredits * 0.1, id)).toContain(ORANGE);
	});

	it.each(plans)('$id: 9%% remaining is red', ({ id, monthlyCredits }) => {
		expect(colorCredits(monthlyCredits * 0.09, id)).toContain(RED);
	});

	it.each(plans)('$id: 0 remaining is red', ({ id }) => {
		expect(colorCredits(0, id)).toContain(RED);
	});
});

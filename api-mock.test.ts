import { describe, it, expect } from 'vitest';
import { PLAN_CREDITS, colorCredits, colorUsage, cyclePct, type Usage } from './lib';

// Comprehensive plan/usage/error edge-case coverage using mocked API-shaped data.

describe('all Command Code plans (credit color coding)', () => {
	const plans = Object.keys(PLAN_CREDITS);

	it('has every known plan', () => {
		expect(plans).toContain('individual-go');
		expect(plans).toContain('individual-goat');
		expect(plans).toContain('individual-pro');
		expect(plans).toContain('individual-pro-v1');
		expect(plans).toContain('individual-provider');
		expect(plans).toContain('individual-max');
		expect(plans).toContain('individual-ultra');
		expect(plans).toContain('teams-pro');
	});

	it.each(plans)('%s: 100%% remaining is green', (planId) => {
		const total = PLAN_CREDITS[planId];
		const out = colorCredits(total, planId);
		expect(out).toContain('\x1b[32m');
	});

	it.each(plans)('%s: 50%% remaining is green (boundary)', (planId) => {
		const total = PLAN_CREDITS[planId];
		const out = colorCredits(total * 0.5, planId);
		expect(out).toContain('\x1b[32m');
	});

	it.each(plans)('%s: 49%% remaining is yellow', (planId) => {
		const total = PLAN_CREDITS[planId];
		const out = colorCredits(total * 0.49, planId);
		expect(out).toContain('\x1b[33m');
	});

	it.each(plans)('%s: 25%% remaining is yellow (boundary)', (planId) => {
		const total = PLAN_CREDITS[planId];
		const out = colorCredits(total * 0.25, planId);
		expect(out).toContain('\x1b[33m');
	});

	it.each(plans)('%s: 24%% remaining is orange', (planId) => {
		const total = PLAN_CREDITS[planId];
		const out = colorCredits(total * 0.24, planId);
		expect(out).toContain('\x1b[38;5;208m');
	});

	it.each(plans)('%s: 10%% remaining is orange (boundary)', (planId) => {
		const total = PLAN_CREDITS[planId];
		const out = colorCredits(total * 0.1, planId);
		expect(out).toContain('\x1b[38;5;208m');
	});

	it.each(plans)('%s: 9%% remaining is red', (planId) => {
		const total = PLAN_CREDITS[planId];
		const out = colorCredits(total * 0.09, planId);
		expect(out).toContain('\x1b[31m');
	});

	it.each(plans)('%s: 0 remaining is red', (planId) => {
		const out = colorCredits(0, planId);
		expect(out).toContain('\x1b[31m');
	});
});

describe('usage color coding at 100% (all windows)', () => {
	it('any window at 100% is red', () => {
		expect(colorUsage(100)).toContain('\x1b[31m');
	});
	it('usage above 100% clamps display to 100 and red', () => {
		expect(colorUsage(150)).toBe('\x1b[31m100%\x1b[0m');
	});
});

describe('cyclePct edge cases', () => {
	it('returns 0 when pool is 0 (no credits anywhere)', () => {
		const u: Usage = {
			planId: '',
			monthlyCredits: 0,
			purchasedCredits: 0,
			freeCredits: 0,
			totalSpent: 50,
			fiveHourUsed: 0,
			fiveHourCap: 0,
			weeklyUsed: 0,
			weeklyCap: 0,
		};
		expect(cyclePct(u)).toBe(0);
	});
	it('returns 0 when totalSpent is negative (bad API data)', () => {
		const u: Usage = {
			planId: 'individual-pro',
			monthlyCredits: 30,
			purchasedCredits: 0,
			freeCredits: 0,
			totalSpent: -5,
			fiveHourUsed: 0,
			fiveHourCap: 0,
			weeklyUsed: 0,
			weeklyCap: 0,
		};
		expect(cyclePct(u)).toBe(0);
	});
	it('caps at 100 even with huge overspend', () => {
		const u: Usage = {
			planId: 'individual-go',
			monthlyCredits: 10,
			purchasedCredits: 0,
			freeCredits: 0,
			totalSpent: 999999,
			fiveHourUsed: 0,
			fiveHourCap: 0,
			weeklyUsed: 0,
			weeklyCap: 0,
		};
		expect(cyclePct(u)).toBe(100);
	});
	it('includes purchased + free credits in the pool', () => {
		const u: Usage = {
			planId: 'individual-go',
			monthlyCredits: 10,
			purchasedCredits: 40,
			freeCredits: 0,
			totalSpent: 25,
			fiveHourUsed: 0,
			fiveHourCap: 0,
			weeklyUsed: 0,
			weeklyCap: 0,
		};
		expect(cyclePct(u)).toBe(50);
	});
});

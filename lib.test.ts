import {describe, it, expect} from 'vitest';
import {
	PLAN_CREDITS,
	CONTEXT_WINDOWS,
	pct,
	colorUsage,
	colorCredits,
	cyclePct,
	shortModelName,
	resolveContextWindow,
	type Usage,
} from './lib';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const ORANGE = '\x1b[38;5;208m';
const RED = '\x1b[31m';

describe('pct', () => {
	it('returns 0 when cap is 0 (no division by zero)', () => {
		expect(pct(5, 0)).toBe(0);
	});
	it('returns 0 when used is 0', () => {
		expect(pct(0, 100)).toBe(0);
	});
	it('computes a normal percentage', () => {
		expect(pct(50, 100)).toBe(50);
	});
	it('caps at 100 when used exceeds cap', () => {
		expect(pct(150, 100)).toBe(100);
	});
	it('treats negative used as 0', () => {
		expect(pct(-5, 100)).toBe(0);
	});
});

describe('colorUsage', () => {
	it('is green below 50', () => {
		expect(colorUsage(0)).toBe(`${GREEN}0%\x1b[0m`);
		expect(colorUsage(49)).toBe(`${GREEN}49%\x1b[0m`);
	});
	it('is yellow at 50', () => {
		expect(colorUsage(50)).toBe(`${YELLOW}50%\x1b[0m`);
	});
	it('is yellow from 50 to 74', () => {
		expect(colorUsage(74)).toBe(`${YELLOW}74%\x1b[0m`);
	});
	it('is orange at 75', () => {
		expect(colorUsage(75)).toBe(`${ORANGE}75%\x1b[0m`);
	});
	it('is orange from 75 to 89', () => {
		expect(colorUsage(89)).toBe(`${ORANGE}89%\x1b[0m`);
	});
	it('is red at 90', () => {
		expect(colorUsage(90)).toBe(`${RED}90%\x1b[0m`);
	});
	it('is red at 100 (fully consumed)', () => {
		expect(colorUsage(100)).toBe(`${RED}100%\x1b[0m`);
	});
	it('caps displayed value at 100', () => {
		expect(colorUsage(130)).toBe(`${RED}100%\x1b[0m`);
	});
});

describe('colorCredits across all plans', () => {
	const plans = Object.keys(PLAN_CREDITS);

	it('covers every known plan', () => {
		expect(plans.length).toBeGreaterThanOrEqual(8);
	});

	it.each(plans)('color-codes %s correctly at boundaries', planId => {
		const total = PLAN_CREDITS[planId];
		const fmt = (remaining: number) => colorCredits(remaining, planId);

		// ≥50% green
		expect(fmt(total)).toBe(`${GREEN}$${total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}\x1b[0m`);
		// 25-49% yellow
		const y = total * 0.3;
		expect(fmt(y).includes(YELLOW)).toBe(true);
		// 10-24% orange
		const o = total * 0.15;
		expect(fmt(o).includes(ORANGE)).toBe(true);
		// <10% red
		const r = total * 0.05;
		expect(fmt(r).includes(RED)).toBe(true);
	});

	it('treats an unknown plan as fully remaining (green)', () => {
		expect(colorCredits(12, 'individual-unknown')).toBe(`${GREEN}$${(12).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}\x1b[0m`);
	});
});

describe('cyclePct', () => {
	const usage = (overrides: Partial<Usage>): Usage => ({
		planId: 'individual-pro',
		fiveHourUsed: 0,
		fiveHourCap: 0,
		weeklyUsed: 0,
		weeklyCap: 0,
		monthlyCredits: 30,
		purchasedCredits: 0,
		freeCredits: 0,
		totalSpent: 0,
		...overrides,
	});

	it('returns 0 when total spent is 0', () => {
		expect(cyclePct(usage({totalSpent: 0}))).toBe(0);
	});
	it('computes against plan pool plus purchased/free', () => {
		// pro-v1 = 80 base, + 20 purchased = 100 pool; 50 spent = 50%
		const u = usage({planId: 'individual-pro-v1', monthlyCredits: 80, purchasedCredits: 20, totalSpent: 50});
		expect(cyclePct(u)).toBe(50);
	});
	it('caps at 100 when fully consumed', () => {
		const u = usage({planId: 'individual-go', monthlyCredits: 10, totalSpent: 999});
		expect(cyclePct(u)).toBe(100);
	});
});

describe('shortModelName', () => {
	it('strips provider prefix and version noise', () => {
		expect(shortModelName('deepseek/deepseek-v4-pro-(latest)')).toBe('deepseek-v4-pro');
		expect(shortModelName('anthropic/claude-opus-5')).toBe('claude-opus-5');
	});
	it('handles already-short names', () => {
		expect(shortModelName('deepseek-v4-pro')).toBe('deepseek-v4-pro');
	});
	it('returns empty for empty input', () => {
		expect(shortModelName('')).toBe('');
	});
});

describe('resolveContextWindow', () => {
	it('resolves by full provider/model id', () => {
		expect(resolveContextWindow('deepseek/deepseek-v4-pro', CONTEXT_WINDOWS)).toBe(1_000_000);
	});
	it('resolves by short name', () => {
		expect(resolveContextWindow('deepseek-v4-pro', CONTEXT_WINDOWS)).toBe(1_000_000);
	});
	it('resolves claude models with dashes', () => {
		expect(resolveContextWindow('anthropic/claude-opus-4-8', CONTEXT_WINDOWS)).toBe(1_000_000);
	});
	it('returns undefined for unknown model', () => {
		expect(resolveContextWindow('unknown/model', CONTEXT_WINDOWS)).toBeUndefined();
	});
	it('returns undefined for empty string', () => {
		expect(resolveContextWindow('', CONTEXT_WINDOWS)).toBeUndefined();
	});
});

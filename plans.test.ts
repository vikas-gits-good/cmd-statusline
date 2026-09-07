import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {colorCredits, PLAN_CREDITS} from './lib';

interface PlanEntry {
	id: string;
	name: string;
	monthlyCredits: number;
}

const plans: PlanEntry[] = JSON.parse(
	readFileSync(join(process.cwd(), 'e2e', 'plans.list.json'), 'utf8'),
).plans;

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const ORANGE = '\x1b[38;5;208m';
const RED = '\x1b[31m';

describe('plans synced from Command Code', () => {
	it('has all expected plan ids', () => {
		const ids = plans.map(p => p.id).sort();
		expect(ids).toEqual(Object.keys(PLAN_CREDITS).sort());
	});

	it.each(plans)('$name ($id) has positive credits', ({monthlyCredits}) => {
		expect(monthlyCredits).toBeGreaterThan(0);
	});

	it.each(plans)('$name ($id) credit amounts match lib PLAN_CREDITS', ({id, monthlyCredits}) => {
		expect(PLAN_CREDITS[id]).toBe(monthlyCredits);
	});

	it.each(plans)('$name ($id): 100%% remaining is green', ({id, monthlyCredits}) => {
		expect(colorCredits(monthlyCredits, id)).toContain(GREEN);
	});

	it.each(plans)('$name ($id): 50%% remaining is green (boundary)', ({id, monthlyCredits}) => {
		expect(colorCredits(monthlyCredits * 0.5, id)).toContain(GREEN);
	});

	it.each(plans)('$name ($id): 49%% remaining is yellow', ({id, monthlyCredits}) => {
		expect(colorCredits(monthlyCredits * 0.49, id)).toContain(YELLOW);
	});

	it.each(plans)('$name ($id): 25%% remaining is yellow (boundary)', ({id, monthlyCredits}) => {
		expect(colorCredits(monthlyCredits * 0.25, id)).toContain(YELLOW);
	});

	it.each(plans)('$name ($id): 24%% remaining is orange', ({id, monthlyCredits}) => {
		expect(colorCredits(monthlyCredits * 0.24, id)).toContain(ORANGE);
	});

	it.each(plans)('$name ($id): 10%% remaining is orange (boundary)', ({id, monthlyCredits}) => {
		expect(colorCredits(monthlyCredits * 0.1, id)).toContain(ORANGE);
	});

	it.each(plans)('$name ($id): 9%% remaining is red', ({id, monthlyCredits}) => {
		expect(colorCredits(monthlyCredits * 0.09, id)).toContain(RED);
	});

	it.each(plans)('$name ($id): 0 remaining is red', ({id}) => {
		expect(colorCredits(0, id)).toContain(RED);
	});
});

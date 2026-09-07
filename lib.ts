// Pure, side-effect-free helpers for the status line. Tested in lib.test.ts.

export const GREEN = '\x1b[32m';
export const YELLOW = '\x1b[33m';
export const ORANGE = '\x1b[38;5;208m';
export const RED = '\x1b[31m';
export const RESET = '\x1b[0m';

// Plan id → total monthly credits (used to color the credits figure).
export const PLAN_CREDITS: Record<string, number> = {
	'individual-go': 10,
	'individual-goat': 70,
	'individual-pro': 30,
	'individual-pro-v1': 80,
	'individual-provider': 15,
	'individual-max': 150,
	'individual-ultra': 300,
	'teams-pro': 40,
};

export const CONTEXT_WINDOWS: Record<string, number> = {
	'deepseek-v4-pro': 1_000_000,
	'deepseek-v4-flash': 1_000_000,
	'deepseek-v4-flash-vision-exp': 1_000_000,
	'deepseek-v4-flash-fast': 1_000_000,
	'claude-sonnet-5': 1_000_000,
	'claude-sonnet-4-6': 1_000_000,
	'claude-fable-5-1': 1_000_000,
	'claude-fable-5': 1_000_000,
	'claude-opus-5': 1_000_000,
	'claude-opus-4-8': 1_000_000,
	'claude-opus-4-7': 1_000_000,
};

export interface Usage {
	planId: string;
	fiveHourUsed: number;
	fiveHourCap: number;
	weeklyUsed: number;
	weeklyCap: number;
	monthlyCredits: number;
	purchasedCredits: number;
	freeCredits: number;
	totalSpent: number;
}

export function pct(used: number, cap: number): number {
	if (cap <= 0) return 0;
	return Math.min(100, Math.max(0, (used / cap) * 100));
}

// Consumption buckets: higher = worse. <50 green, 50-74 yellow, 75-89 orange, ≥90 red.
export function colorUsage(n: number): string {
	const v = Math.min(100, Math.round(n));
	let color = GREEN;
	if (v >= 50) color = YELLOW;
	if (v >= 75) color = ORANGE;
	if (v >= 90) color = RED;
	return `${color}${v}%${RESET}`;
}

// Credits buckets: higher = better. ≥50 green, 25-49 yellow, 10-24 orange, <10 red.
export function colorCredits(remaining: number, planId: string): string {
	const total = PLAN_CREDITS[planId];
	const pctLeft = total && total > 0 ? (remaining / total) * 100 : 100;
	let color = GREEN;
	if (pctLeft < 50) color = YELLOW;
	if (pctLeft < 25) color = ORANGE;
	if (pctLeft < 10) color = RED;
	const s = remaining.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
	return `${color}$${s}${RESET}`;
}

export function shortModelName(full: string): string {
	if (!full) return '';
	let s = full.replace(/^[^/]+\//, '');
	s = s.replace(/-\([^)]*\)/g, '');
	s = s.replace(/\([^)]*\)/g, '');
	s = s.replace(/-$/, '');
	return s.trim();
}

// Resolve a context window for a model id, whether it arrives as a full
// "provider/model" slug or an already-short name.
export function resolveContextWindow(modelId: string, windows: Record<string, number> = CONTEXT_WINDOWS): number | undefined {
	if (!modelId) return undefined;
	const short = shortModelName(modelId);
	return windows[short] ?? windows[modelId];
}

export function cyclePct(u: Usage): number {
	const planTotal = PLAN_CREDITS[u.planId] ?? u.monthlyCredits;
	const pool = Math.max(planTotal, u.monthlyCredits) + u.purchasedCredits + u.freeCredits;
	if (pool <= 0) return 0;
	return pct(u.totalSpent, pool);
}

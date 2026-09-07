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

export interface StatusState {
	cwd: string;
	branch: string;
	dirty: boolean;
	sessionName: string;
	model: string;
	effort: string;
	currentTokens: number;
	contextLimit: number;
	usage: Usage | null;
}

export interface StatusSegments {
	cwd: string;
	branch: string;
	dirty: string;
	sessionName: string;
	model: string;
	effort: string;
	cntx: number;
	usge: number | null;
	skly: number | null;
	totl: number | null;
	crdt: string | null;
}

// Compute semantic segments (for tests/harness) from state, using the same
// math as buildStatusLine. No string concatenation here — just the values.
export function computeStatus(s: StatusState): StatusSegments {
	const ctx = s.contextLimit > 0 ? pct(s.currentTokens, s.contextLimit) : 0;
	const usge = s.usage ? pct(s.usage.fiveHourUsed, s.usage.fiveHourCap) : null;
	const skly = s.usage ? pct(s.usage.weeklyUsed, s.usage.weeklyCap) : null;
	const totl = s.usage ? cyclePct(s.usage) : null;
	const crdt = s.usage
		? (s.usage.monthlyCredits + s.usage.purchasedCredits + s.usage.freeCredits).toFixed(2)
		: null;
	return {
		cwd: s.cwd,
		branch: s.branch,
		dirty: s.dirty ? 'dirty' : 'clean',
		sessionName: s.sessionName,
		model: s.model,
		effort: s.effort,
		cntx: Math.round(ctx),
		usge: usge === null ? null : Math.round(usge),
		skly: skly === null ? null : Math.round(skly),
		totl: totl === null ? null : Math.round(totl),
		crdt,
	};
}

const DIM = '\x1b[2m';

// Pure render of the status line from state. Side-effect free; the only
// place the string shape lives, so reactivity is a matter of calling this
// with fresh state.
export function buildStatusLine(s: StatusState): string {
	const dot = s.dirty ? `${ORANGE}●${RESET}` : `${GREEN}●${RESET}`;
	const branchText = s.branch ? `, ${s.branch} ${dot}` : '';
	const nameText = s.sessionName ? `, ${s.sessionName}` : '';

	const ctx = s.contextLimit > 0 ? pct(s.currentTokens, s.contextLimit) : 0;

	const shortModel = shortModelName(s.model);
	const modelText = shortModel ? `${shortModel}, ` : '';
	const effortText = s.effort ? `${s.effort}, ` : '';

	let right = `${modelText}${effortText}cntx: ${colorUsage(ctx)}`;
	if (s.usage) {
		const usg = pct(s.usage.fiveHourUsed, s.usage.fiveHourCap);
		const wkl = pct(s.usage.weeklyUsed, s.usage.weeklyCap);
		const tot = cyclePct(s.usage);
		const remaining = s.usage.monthlyCredits + s.usage.purchasedCredits + s.usage.freeCredits;
		right += `, usge: ${colorUsage(usg)}, skly: ${colorUsage(wkl)}, totl: ${colorUsage(tot)}, crdt: ${colorCredits(remaining, s.usage.planId)}`;
	}

	return `${s.cwd}${branchText}${nameText}  ${DIM}│${RESET}  ${right}`;
}

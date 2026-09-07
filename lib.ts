// Pure, side-effect-free helpers for the status line. Tested in lib.test.ts.

export const GREEN = '\x1b[32m';
export const YELLOW = '\x1b[33m';
export const ORANGE = '\x1b[38;5;208m';
export const RED = '\x1b[31m';
export const RESET = '\x1b[0m';
export const DIM = '\x1b[2m';

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
	'MiniMaxAI/MiniMax-M2.5': 200000,
	'MiniMaxAI/MiniMax-M3': 1000000,
	'MiniMaxAI/MiniMax-M3-Free': 1000000,
	'Qwen/Qwen3.7-Flash': 1000000,
	'Qwen/Qwen3.7-Max': 1000000,
	'Qwen/Qwen3.7-Plus': 1000000,
	'Qwen/Qwen3.8-27B': 262144,
	'Qwen/Qwen3.8-Flash': 1000000,
	'Qwen/Qwen3.8-Max': 1000000,
	'Qwen/Qwen3.8-Max-0902': 1000000,
	'claude-fable-5': 1000000,
	'claude-fable-5-1': 1000000,
	'claude-haiku-4-5-20251001': 200000,
	'claude-opus-4-7': 1000000,
	'claude-opus-4-8': 1000000,
	'claude-opus-5': 1000000,
	'claude-sonnet-4-6': 1000000,
	'claude-sonnet-5': 1000000,
	'deepseek/deepseek-v4-flash': 1000000,
	'deepseek/deepseek-v4-flash-fast': 1000000,
	'deepseek/deepseek-v4-flash-vision-exp': 1000000,
	'deepseek/deepseek-v4-pro': 1000000,
	'google/gemini-3.1-flash-lite': 1000000,
	'google/gemini-3.5-flash': 1000000,
	'google/gemini-3.5-flash-lite': 1000000,
	'google/gemini-3.6-flash': 1000000,
	'google/gemini-3.7-flash': 1048576,
	'google/gemini-3.8-flash': 1000000,
	'gpt-5.3-codex': 400000,
	'gpt-5.4': 400000,
	'gpt-5.4-mini': 400000,
	'gpt-5.5': 400000,
	'gpt-5.6-luna': 1050000,
	'gpt-5.6-sol': 1050000,
	'gpt-5.6-terra': 1050000,
	'gpt-6-astra': 1050000,
	'inclusionai/ling-3.0-flash-free': 256000,
	'meituan/LongCat-2.0:free': 1048576,
	'meta/muse-spark-1.1': 1048576,
	'meta/muse-spark-1.2': 1048576,
	'meta/muse-spark-1.2-contributor': 1048576,
	'meta/muse-spark-1.3': 1048576,
	'meta/muse-spark-1.3-contributor': 1048576,
	'minimax/minimax-m2.7-free': 197000,
	'minimax/minimax-m3-free': 1000000,
	'moonshotai/Kimi-K2.5': 256000,
	'moonshotai/Kimi-K2.6': 256000,
	'moonshotai/Kimi-K2.7-Code': 256000,
	'moonshotai/Kimi-K2.7-Code-Highspeed': 262000,
	'moonshotai/Kimi-K3': 1000000,
	'nvidia/nemotron-3-ultra-550b-a55b': 1000000,
	'poolside/laguna-s-2.1-free': 256000,
	'sakana/fugu-ultra': 1000000,
	'stepfun/Step-3.5-Flash': 1000000,
	'stepfun/Step-3.7-Flash': 256000,
	'tencent/Hy3': 262144,
	'tencent/hy3-paid': 262144,
	'tencent/hy4-preview': 1048576,
	'thinkingmachines/inkling': 256000,
	'thinkingmachines/inkling-small': 1000000,
	'xai/grok-4.5': 500000,
	'xai/grok-4.6': 500000,
	'xiaomi/mimo-v2.5': 1000000,
	'xiaomi/mimo-v2.5-pro': 1000000,
	'z-ai/glm-5.3-flash': 1048576,
	'zai-org/GLM-5': 200000,
	'zai-org/GLM-5.2': 1000000,
	'zai-org/GLM-5.2-Fast': 1000000,
	'zai-org/GLM-5.3': 1000000,
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

// Strip control characters that could spoof terminal escapes. Display fields
// come from user-controlled (session title) and filesystem-controlled (cwd)
// sources, so sanitize before composing the status line.
export function sanitizeDisplay(text: string): string {
	// eslint-disable-next-line no-control-regex
	return text.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim();
}

// Remove ANSI escape sequences so width can be measured on the visible text
// (the terminal truncates on the rendered, not raw, length).
export function stripAnsi(text: string): string {
	// eslint-disable-next-line no-control-regex
	return text.replace(/\x1b\[[0-9;]*m/g, '');
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

// Single source of truth for money formatting (used by both colorCredits and
// computeStatus so the two can never drift).
export function formatMoney(n: number): string {
	return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Credits buckets: higher = better. ≥50 green, 25-49 yellow, 10-24 orange, <10 red.
export function colorCredits(remaining: number, planId: string): string {
	const total = PLAN_CREDITS[planId];
	const pctLeft = total && total > 0 ? (remaining / total) * 100 : 100;
	let color = GREEN;
	if (pctLeft < 50) color = YELLOW;
	if (pctLeft < 25) color = ORANGE;
	if (pctLeft < 10) color = RED;
	return `${color}$${formatMoney(remaining)}${RESET}`;
}

export function shortModelName(full: string): string {
	if (!full) return '';
	let s = full.replace(/^[^/]+\//, '');
	s = s.replace(/-\([^)]*\)/g, '');
	s = s.replace(/\([^)]*\)/g, '');
	s = s.replace(/-$/, '');
	return s.trim();
}

// Normalize `git rev-parse --abbrev-ref HEAD` output. In detached HEAD state
// git returns the literal string "HEAD", which is not a branch name — treat it
// as empty so the status line omits a bogus branch.
export function normalizeBranch(raw: string): string {
	const b = raw.trim();
	return b === 'HEAD' ? '' : b;
}

// Choose the session name to display. The disk value (read fresh from the
// session meta/transcript) wins over a cached event value, because a manual
// /rename writes to disk but does not emit a `session_titled` event. Returns
// '' when neither is available.
export function pickSessionName(diskName: string, eventName: string): string {
	const d = diskName.trim();
	if (d) return d;
	return eventName.trim();
}

// Classify a `config_setting_changed` event payload into the piece of status
// state it affects. Returns null for settings the status line doesn't render.
export function classifyConfigChange(setting: string, value: unknown): 'model' | 'effort' | null {
	if (setting === 'model' && typeof value === 'string' && value) return 'model';
	if (setting === 'effort' && typeof value === 'string' && value) return 'effort';
	return null;
}

export const DEFAULT_CONTEXT_WINDOW = 200_000;

export interface ResolveContextWindowOpts {
	envOverride?: number;
	fallback?: boolean;
}

// Resolve a context window for a model id, whether it arrives as a full
// "provider/model" slug, an already-short name, or a short name that needs a
// provider prefix (e.g. "deepseek-v4-pro" → "deepseek/deepseek-v4-pro").
// Precedence: env override (valid >0) → map lookup (case-insensitive) →
// opts.fallback ? DEFAULT_CONTEXT_WINDOW : undefined.
export function resolveContextWindow(
	modelId: string,
	windows: Record<string, number> = CONTEXT_WINDOWS,
	opts: ResolveContextWindowOpts = {},
): number | undefined {
	if (opts.envOverride !== undefined && Number.isFinite(opts.envOverride) && opts.envOverride > 0) {
		return opts.envOverride;
	}
	if (!modelId) return opts.fallback ? DEFAULT_CONTEXT_WINDOW : undefined;
	const short = shortModelName(modelId);
	// Try exact, then short, then a few common provider prefixes for short names.
	const candidates = [modelId, short];
	for (const prefix of [
		'deepseek/',
		'anthropic/',
		'openai/',
		'google/',
		'xai/',
		'meta/',
		'sakana/',
		'nvidia/',
		'poolside/',
		'stepfun/',
		'tencent/',
		'xiaomi/',
		'minimax/',
		'moonshotai/',
	]) {
		if (!short.includes('/')) candidates.push(`${prefix}${short}`);
	}
	for (const c of candidates) {
		if (c in windows) return windows[c];
	}
	// Case-insensitive fallback.
	const lower = modelId.toLowerCase();
	for (const key of Object.keys(windows)) {
		if (key.toLowerCase() === lower) return windows[key];
	}
	const shortLower = short.toLowerCase();
	for (const key of Object.keys(windows)) {
		if (key.toLowerCase().endsWith(`/${shortLower}`) || key.toLowerCase() === shortLower)
			return windows[key];
	}
	return opts.fallback ? DEFAULT_CONTEXT_WINDOW : undefined;
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
	// null = unknown context window (model not in CONTEXT_WINDOWS)
	cntx: number | null;
	cntxRemaining: number | null;
	usge: number | null;
	wkly: number | null;
	totl: number | null;
	crdt: string | null;
}

// Compute semantic segments from state. This is the single source of truth
// for every number; buildStatusLine and the E2E harness both derive from it.
export function computeStatus(s: StatusState): StatusSegments {
	const hasContext = s.contextLimit > 0;
	const ctx = hasContext ? pct(s.currentTokens, s.contextLimit) : null;
	const usge = s.usage ? pct(s.usage.fiveHourUsed, s.usage.fiveHourCap) : null;
	const wkly = s.usage ? pct(s.usage.weeklyUsed, s.usage.weeklyCap) : null;
	const totl = s.usage ? cyclePct(s.usage) : null;
	const crdt = s.usage
		? formatMoney(s.usage.monthlyCredits + s.usage.purchasedCredits + s.usage.freeCredits)
		: null;
	return {
		cwd: sanitizeDisplay(s.cwd),
		branch: s.branch,
		dirty: s.dirty ? 'dirty' : 'clean',
		sessionName: sanitizeDisplay(s.sessionName),
		model: sanitizeDisplay(s.model),
		effort: sanitizeDisplay(s.effort),
		cntx: ctx === null ? null : Math.round(ctx),
		cntxRemaining: ctx === null ? null : 100 - Math.round(ctx),
		usge: usge === null ? null : Math.round(usge),
		wkly: wkly === null ? null : Math.round(wkly),
		totl: totl === null ? null : Math.round(totl),
		crdt,
	};
}

// Truncate a single field to `max` visible characters, appending a single
// ellipsis so truncation is always visible and never a hard mid-word cut.
export function ellipsize(text: string, max: number): string {
	if (max <= 0) return '…';
	if (text.length <= max) return text;
	if (max === 1) return '…';
	return `${text.slice(0, max - 1).trimEnd()}…`;
}

// Pure render of the status line from state. Derives all numbers from
// computeStatus so there is exactly one implementation of the math.
//
// maxWidth is optional. When set, fields are dropped from the right (lowest
// priority) first, and any single field that is too long is ellipsized as a
// whole ("…"), never partially cut to wrap onto a second line.
export function buildStatusLine(s: StatusState, maxWidth?: number): string {
	const seg = computeStatus(s);

	const dot = seg.dirty === 'dirty' ? `${ORANGE}●${RESET}` : `${GREEN}●${RESET}`;
	const shortModel = shortModelName(seg.model);

	// Unknown context window → explicit unavailable marker, never a misleading
	// green 0%.
	const cntxText = seg.cntx === null ? `${DIM}--${RESET}` : colorUsage(seg.cntx);

	// Each field is atomic: whole, ellipsized, or absent — never split.
	// priority order = left-to-right display order; higher = more important.
	type Field = { text: string; priority: number; droppable: boolean };
	const fields: Field[] = [
		{ text: seg.cwd, priority: 100, droppable: false }, // identity, never drop
	];
	if (seg.branch) fields.push({ text: `${seg.branch} ${dot}`, priority: 90, droppable: false });
	if (seg.sessionName) fields.push({ text: seg.sessionName, priority: 80, droppable: true });
	fields.push(
		{ text: DIM + '│' + RESET, priority: 70, droppable: false }, // separator
		{ text: shortModel, priority: 60, droppable: false },
		{ text: seg.effort, priority: 50, droppable: true },
		{ text: `cntx: ${cntxText}`, priority: 40, droppable: false },
	);
	if (s.usage) {
		fields.push(
			{ text: `usge: ${colorUsage(seg.usge ?? 0)}`, priority: 30, droppable: true },
			{ text: `wkly: ${colorUsage(seg.wkly ?? 0)}`, priority: 20, droppable: true },
			{ text: `totl: ${colorUsage(seg.totl ?? 0)}`, priority: 10, droppable: true },
			{
				text: `crdt: ${colorCredits(s.usage.monthlyCredits + s.usage.purchasedCredits + s.usage.freeCredits, s.usage.planId)}`,
				priority: 5,
				droppable: true,
			},
		);
	}

	const join = (parts: Field[]): string => {
		let out = '';
		for (let i = 0; i < parts.length; i++) {
			const p = parts[i];
			if (i === 0) {
				out += p.text;
			} else if (p.priority === 70) {
				// separator
				out += `  ${p.text}  `;
			} else if (parts[i - 1]?.priority === 70) {
				out += p.text;
			} else {
				out += `, ${p.text}`;
			}
		}
		return out;
	};

	const fits = (line: string) => maxWidth === undefined || stripAnsi(line).length <= maxWidth;

	// Greedy: keep as many fields as possible in priority order, dropping the
	// lowest-priority droppable fields when the line is too wide.
	let kept = [...fields];
	let line = join(kept);
	if (fits(line)) return line;

	// Drop droppable fields from lowest priority upward.
	const droppable = kept.filter((f) => f.droppable).sort((a, b) => a.priority - b.priority);
	for (const drop of droppable) {
		kept = kept.filter((f) => f !== drop);
		line = join(kept);
		if (fits(line)) return line;
	}

	// Still too wide: ellipsize the single widest non-droppable field so the
	// whole line fits on one line without a partial cut. At this point maxWidth
	// is guaranteed to be defined (the earlier fits() already returned for
	// undefined) and the line is still too wide.
	line = join(kept);
	const visible = stripAnsi(line);
	if (visible.length <= maxWidth!) return line;

	// Separator consumes a fixed width; subtract it.
	const sep = kept.find((f) => f.priority === 70);
	const sepWidth = sep ? stripAnsi(`  ${sep.text}  `).length : 0;
	const sepIdx = kept.indexOf(sep!);
	const before = kept.slice(0, sepIdx);
	const after = kept.slice(sepIdx + 1);
	const beforeWidth = stripAnsi(join(before)).length;
	const afterWidth = stripAnsi(join(after)).length;
	const available = Math.max(1, maxWidth! - beforeWidth - afterWidth - sepWidth);
	// Ellipsize the widest field in `before` (cwd/branch).
	const target = before.reduce(
		(a, b) => (stripAnsi(b.text).length > stripAnsi(a.text).length ? b : a),
		before[0],
	);
	if (target) {
		const idx = kept.indexOf(target);
		const ell = ellipsize(target.text, available);
		const rebuilt = join([...kept.slice(0, idx), { ...target, text: ell }, ...kept.slice(idx + 1)]);
		if (fits(rebuilt)) return rebuilt;
	}
	// Fallback: return the leftmost identity ellipsized to the budget.
	return ellipsize(seg.cwd, maxWidth!);
}

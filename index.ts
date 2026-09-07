// StockUp status bar mod.
// Renders one footer segment (setStatus collapses newlines):
//   <cwd>, <branch> <dot>, <session-name> │ <model>, <effort> ctx: N%, usg: N%, wkl: N%, tot: N%, crd: $N
import type {ModApi} from '@commandcode/harness';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const ORANGE = '\x1b[38;5;208m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const API_BASE = 'https://api.commandcode.ai';

// Plan id → total monthly credits (used to color the credits figure).
const PLAN_CREDITS: Record<string, number> = {
	'individual-go': 10,
	'individual-goat': 70,
	'individual-pro': 30,
	'individual-pro-v1': 80,
	'individual-provider': 15,
	'individual-max': 150,
	'individual-ultra': 300,
	'teams-pro': 40,
};

const CONTEXT_WINDOWS: Record<string, number> = {
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

interface Usage {
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

function pct(used: number, cap: number): number {
	return cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
}

// Consumption buckets: higher = worse. <50 green, 50-74 yellow, 75-89 orange, ≥90 red.
function colorUsage(n: number): string {
	const v = Math.round(n);
	let color = GREEN;
	if (v >= 50) color = YELLOW;
	if (v >= 75) color = ORANGE;
	if (v >= 90) color = RED;
	return `${color}${v}%${RESET}`;
}

// Credits buckets: higher = better. ≥50 green, 25-49 yellow, 10-24 orange, <10 red.
function colorCredits(remaining: number, planId: string): string {
	const total = PLAN_CREDITS[planId];
	const pctLeft = total && total > 0 ? (remaining / total) * 100 : 100;
	let color = GREEN;
	if (pctLeft < 50) color = YELLOW;
	if (pctLeft < 25) color = ORANGE;
	if (pctLeft < 10) color = RED;
	const s = remaining.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
	return `${color}$${s}${RESET}`;
}

function shortModelName(full: string): string {
	if (!full) return '';
	let s = full.replace(/^[^/]+\//, '');
	s = s.replace(/-\([^)]*\)/g, '');
	s = s.replace(/\([^)]*\)/g, '');
	s = s.replace(/-$/, '');
	return s.trim();
}

async function readAuthKey(): Promise<string | null> {
	const env = process.env.COMMAND_CODE_API_KEY?.trim();
	if (env) return env;

	try {
		const fs = await import('node:fs/promises');
		const os = await import('node:os');
		const path = await import('node:path');
		const p = path.join(os.homedir(), '.commandcode', 'auth.json');
		const raw = await fs.readFile(p, 'utf8');
		const parsed = JSON.parse(raw) as {apiKey?: string};
		return parsed.apiKey ?? null;
	} catch {
		return null;
	}
}

async function fetchUsage(): Promise<Usage | null> {
	const key = await readAuthKey();
	if (!key) return null;

	const headers = {
		Authorization: `Bearer ${key}`,
		'Content-Type': 'application/json',
		'User-Agent': 'cli',
		'x-cli-environment': 'cli',
		'x-command-code-version': '1.50.0',
	};

	const credits = await fetch(`${API_BASE}/alpha/billing/credits`, {headers});
	const creditsJson = (await credits.json()) as {
		credits: {
			monthlyCredits?: number;
			purchasedCredits?: number;
			freeCredits?: number;
		};
		windowLimits: {
			fiveHour?: {used?: number; cap?: number};
			weekly?: {used?: number; cap?: number};
		};
	};

	const sub = await fetch(`${API_BASE}/alpha/billing/subscriptions`, {headers});
	const subJson = (await sub.json()) as {data?: {planId?: string; currentPeriodStart?: string}};
	const planId = subJson.data?.planId ?? '';
	const since = subJson.data?.currentPeriodStart ?? undefined;

	const summaryPath = `${API_BASE}/alpha/usage/summary${since ? `?since=${encodeURIComponent(since)}` : ''}`;
	const summary = await fetch(summaryPath, {headers});
	const summaryJson = (await summary.json()) as {totalCost?: number};

	return {
		planId,
		fiveHourUsed: creditsJson.windowLimits.fiveHour?.used ?? 0,
		fiveHourCap: creditsJson.windowLimits.fiveHour?.cap ?? 0,
		weeklyUsed: creditsJson.windowLimits.weekly?.used ?? 0,
		weeklyCap: creditsJson.windowLimits.weekly?.cap ?? 0,
		monthlyCredits: creditsJson.credits.monthlyCredits ?? 0,
		purchasedCredits: creditsJson.credits.purchasedCredits ?? 0,
		freeCredits: creditsJson.credits.freeCredits ?? 0,
		totalSpent: summaryJson.totalCost ?? 0,
	};
}

function cyclePct(u: Usage): number {
	const planTotal = PLAN_CREDITS[u.planId] ?? u.monthlyCredits;
	const pool = Math.max(planTotal, u.monthlyCredits) + u.purchasedCredits + u.freeCredits;
	if (pool <= 0) return 0;
	return pct(u.totalSpent, pool);
}

export default function (cmd: ModApi): void {
	let model = '';
	let effort = '';
	let sessionName = '';
	let currentTokens = 0;
	let contextLimit = 0;

	let usage: Usage | null = null;
	let lastUsageFetch = 0;

	async function refreshUsage(): Promise<void> {
		const now = Date.now();
		if (now - lastUsageFetch < 30_000) return;
		lastUsageFetch = now;
		try {
			usage = await fetchUsage();
		} catch {
			// keep last known
		}
	}

	// Locate the current session's transcript + meta files on disk.
	async function locateSessionFiles(): Promise<{metaPath: string; transcriptPath: string} | null> {
		const fs = await import('node:fs/promises');
		const os = await import('node:os');
		const path = await import('node:path');

		// COMMANDCODE_SCRATCHPAD = .../<cwd-slug>/<session-id>/scratchpad
		const scratch = process.env.COMMANDCODE_SCRATCHPAD;
		if (!scratch) return null;
		const parts = scratch.split('/').filter(Boolean);
		const scratchIdx = parts.lastIndexOf('scratchpad');
		const sessionId = scratchIdx >= 1 ? parts[scratchIdx - 1] : null;
		if (!sessionId) return null;

		const projects = path.join(os.homedir(), '.commandcode', 'projects');
		const dirs = await fs.readdir(projects);
		for (const d of dirs) {
			const metaPath = path.join(projects, d, `${sessionId}.meta.json`);
			try {
				await fs.access(metaPath);
				return {metaPath, transcriptPath: path.join(projects, d, `${sessionId}.jsonl`)};
			} catch {
				// keep scanning other project dirs
			}
		}
		return null;
	}

	// Single source of truth for reloads: read title/model/effort/context from disk.
	async function refreshFromDisk(): Promise<void> {
		try {
			const files = await locateSessionFiles();
			if (!files) return;
			const fs = await import('node:fs/promises');

			const meta = JSON.parse(await fs.readFile(files.metaPath, 'utf8')) as {title?: string; model?: string};
			if (meta.title) sessionName = meta.title;
			if (meta.model) {
				model = meta.model;
				contextLimit = CONTEXT_WINDOWS[model] ?? contextLimit;
			}

			// Scan transcript backwards for the latest assistant entry with effort/usage.
			const raw = await fs.readFile(files.transcriptPath, 'utf8');
			const lines = raw.split('\n');
			for (let i = lines.length - 1; i >= 0; i--) {
				const line = lines[i].trim();
				if (!line) continue;
				let entry: {model?: string; effort?: string; usage?: {inputTokens?: number; outputTokens?: number}};
				try {
					entry = JSON.parse(line);
				} catch {
					continue;
				}
				if (entry.effort) effort = entry.effort;
				if (entry.usage) {
					currentTokens = (entry.usage.inputTokens ?? 0) + (entry.usage.outputTokens ?? 0);
					break;
				}
			}
		} catch {
			// keep whatever is in memory
		}
	}

	async function render(): Promise<void> {
		const cwd = (cmd.cwd || '').split('/').filter(Boolean).pop() || cmd.cwd || '';

		let branch = '';
		let dirty = false;
		try {
			const b = await cmd.exec({command: 'git', args: ['rev-parse', '--abbrev-ref', 'HEAD'], cwd: cmd.cwd});
			branch = b.stdout.trim();
			const s = await cmd.exec({command: 'git', args: ['status', '--porcelain'], cwd: cmd.cwd});
			dirty = s.stdout.trim().length > 0;
		} catch {
			// not a git repo
		}

		const dot = dirty ? `${ORANGE}●${RESET}` : `${GREEN}●${RESET}`;
		const branchText = branch ? `, ${branch} ${dot}` : '';
		const nameText = sessionName ? `, ${sessionName}` : '';

		const ctx = contextLimit > 0 ? pct(currentTokens, contextLimit) : 0;

		await refreshUsage();

		const shortModel = shortModelName(model);
		const modelText = shortModel ? `${shortModel}, ` : '';
		const effortText = effort ? `${effort} ` : '';

		let right = `${modelText}${effortText}ctx: ${colorUsage(ctx)}`;
		if (usage) {
			const usg = pct(usage.fiveHourUsed, usage.fiveHourCap);
			const wkl = pct(usage.weeklyUsed, usage.weeklyCap);
			const tot = cyclePct(usage);
			const remaining = usage.monthlyCredits + usage.purchasedCredits + usage.freeCredits;
			right += `, usg: ${colorUsage(usg)}, wkl: ${colorUsage(wkl)}, tot: ${colorUsage(tot)}, crd: ${colorCredits(remaining, usage.planId)}`;
		}

		const left = `${cwd}${branchText}${nameText}`;

		cmd.ui.setStatus(`${left}  ${DIM}│${RESET}  ${right}`);
	}

	cmd.on('model_request_start', e => {
		if (e.type === 'model_request_start' && typeof e.model === 'string') {
			model = e.model;
			contextLimit = CONTEXT_WINDOWS[model] ?? contextLimit;
		}
	});

	cmd.on('model_request_end', e => {
		if (e.type === 'model_request_end') {
			const ev = e as {model?: string; effort?: string; usage?: {inputTokens?: number; outputTokens?: number}};
			if (typeof ev.model === 'string') model = ev.model;
			if (typeof ev.effort === 'string' && ev.effort) effort = ev.effort;
			if (ev.usage) {
				currentTokens = (ev.usage.inputTokens ?? 0) + (ev.usage.outputTokens ?? 0);
			}
			void render();
		}
	});

	cmd.on('session_titled', e => {
		if (e.type === 'session_titled' && typeof e.title === 'string') {
			sessionName = e.title;
			void render();
		}
	});

	cmd.on('config_setting_changed', e => {
		if (e.type === 'config_setting_changed' && e.setting === 'effort' && typeof e.value === 'string') {
			effort = e.value;
			void render();
		}
	});

	cmd.hooks({
		onSessionStart: () => {
			void (async () => {
				await refreshFromDisk();
				await refreshUsage();
				await render();
			})();
		},
		onSessionEnd: () => {
			cmd.ui.setStatus(null);
		},
	});

	// Seed immediately too, in case the session-start hook has already fired.
	void (async () => {
		await refreshFromDisk();
		await refreshUsage();
		await render();
	})();
}

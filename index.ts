// cmd-statusline mod.
// Renders one footer segment (setStatus collapses newlines):
//   <cwd>, <branch> <dot>, <session-name> │ <model>, <effort> cntx: N%, usge: N%, skly: N%, totl: N%, crdt: $N
import type {ModApi} from '@commandcode/harness';
import {
	GREEN,
	YELLOW,
	ORANGE,
	RED,
	RESET,
	PLAN_CREDITS,
	pct,
	colorUsage,
	colorCredits,
	shortModelName,
	resolveContextWindow,
	cyclePct,
	buildStatusLine,
	type Usage,
} from './lib';

const DIM = '\x1b[2m';

const API_BASE = 'https://api.commandcode.ai';

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
		const fs = await import('node:fs/promises');
		const os = await import('node:os');
		const path = await import('node:path');

		// Fallback for brand-new sessions (no transcript yet): configured model + effort.
		try {
			const cfgPath = path.join(os.homedir(), '.commandcode', 'config.json');
			const cfg = JSON.parse(await fs.readFile(cfgPath, 'utf8')) as {
				model?: string;
				reasoningEffort?: Record<string, string>;
			};
			if (cfg.model) {
				model = cfg.model;
				contextLimit = resolveContextWindow(model) ?? contextLimit;
				if (cfg.reasoningEffort?.[model]) effort = cfg.reasoningEffort[model];
			}
		} catch {
			// config.json unavailable; fall through to transcript below
		}

		const files = await locateSessionFiles();
		if (!files) return;

		const meta = JSON.parse(await fs.readFile(files.metaPath, 'utf8')) as {title?: string; model?: string};
		if (meta.title) sessionName = meta.title;
		if (meta.model) {
			model = meta.model;
			contextLimit = resolveContextWindow(model) ?? contextLimit;
		}

		// Scan transcript backwards for the latest assistant entry with model/effort/usage.
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
			if (entry.model) model = entry.model;
			if (entry.effort) effort = entry.effort;
			if (entry.usage) {
				currentTokens = (entry.usage.inputTokens ?? 0) + (entry.usage.outputTokens ?? 0);
				break;
			}
		}
	}

	let refreshing = false;

	// Single entry point that gathers everything, then renders once.
	async function fullRefresh(): Promise<void> {
		if (refreshing) return;
		refreshing = true;
		try {
			await refreshFromDisk();
			await refreshUsage();
			await render();
		} finally {
			refreshing = false;
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

		const line = buildStatusLine({
			cwd,
			branch,
			dirty,
			sessionName,
			model,
			effort,
			currentTokens,
			contextLimit,
			usage,
		});

		cmd.ui.setStatus(line);
	}

	cmd.on('model_request_start', e => {
		if (e.type === 'model_request_start' && typeof e.model === 'string') {
			model = e.model;
			contextLimit = resolveContextWindow(model) ?? contextLimit;
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
			void fullRefresh();
		},
		onSessionEnd: () => {
			cmd.ui.setStatus(null);
			if (interval) clearInterval(interval);
		},
	});

	// Seed immediately too, in case the session-start hook has already fired.
	void fullRefresh();

	// Reactivity: re-render periodically so usage + git state stay fresh.
	// Usage fetch is throttled to 30s internally; the render itself is cheap.
	const interval = setInterval(() => {
		void (async () => {
			await refreshUsage();
			await render();
		})();
	}, 30_000);
	interval.unref?.();
}

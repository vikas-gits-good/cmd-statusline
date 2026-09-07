// cmd-statusline mod.
// Renders one footer segment (setStatus collapses newlines):
//   <cwd>, <branch> <dot>, <session-name> │ <model>, <effort> cntx: N%, usge: N%, wkly: N%, totl: N%, crdt: $N
import type {ModApi} from '@commandcode/harness';
import {resolveContextWindow, buildStatusLine, type Usage} from './lib';

const API_BASE = 'https://api.commandcode.ai';
const CLIENT_VERSION = '1.50.0';
const USAGE_FETCH_THROTTLE_MS = 30_000;
const USAGE_FETCH_TIMEOUT_MS = 10_000;
const RENDER_INTERVAL_MS = 30_000;

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
		'x-command-code-version': CLIENT_VERSION,
	};

	const fetchJson = async (url: string) => {
		const res = await fetch(url, {headers, signal: AbortSignal.timeout(USAGE_FETCH_TIMEOUT_MS)});
		if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
		return res.json();
	};

	const [creditsJson, subJson] = await Promise.all([
		fetchJson(`${API_BASE}/alpha/billing/credits`),
		fetchJson(`${API_BASE}/alpha/billing/subscriptions`),
	]) as [
		{
			credits: {monthlyCredits?: number; purchasedCredits?: number; freeCredits?: number};
			windowLimits: {fiveHour?: {used?: number; cap?: number}; weekly?: {used?: number; cap?: number}};
		},
		{data?: {planId?: string; currentPeriodStart?: string}},
	];

	const planId = subJson.data?.planId ?? '';
	const since = subJson.data?.currentPeriodStart ?? undefined;
	const summaryPath = `${API_BASE}/alpha/usage/summary${since ? `?since=${encodeURIComponent(since)}` : ''}`;
	const summaryJson = (await fetchJson(summaryPath)) as {totalCost?: number};

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
	// 0 = unknown context window. Never retain a stale previous model's window.
	let contextLimit = 0;

	let usage: Usage | null = null;
	let lastUsageFetch = 0;
	let refreshing = false;
	let renderChain: Promise<void> = Promise.resolve();
	const warn = (msg: string) => {
		try {
			cmd.ui.notify(`[cmd-statusline] ${msg}`);
		} catch {
			// notification is best-effort; never crash the mod
		}
	};

	async function refreshUsage(): Promise<void> {
		const now = Date.now();
		if (now - lastUsageFetch < USAGE_FETCH_THROTTLE_MS) return;
		lastUsageFetch = now;
		try {
			usage = await fetchUsage();
		} catch (err) {
			// Distinguish auth failure from transient network errors, log one line,
			// never include the key.
			const msg = err instanceof Error && /401/.test(err.message) ? 'usage API auth failed' : 'usage API unreachable';
			warn(msg);
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
		const parts = scratch.split(path.sep).filter(Boolean);
		const scratchIdx = parts.lastIndexOf('scratchpad');
		const sessionId = scratchIdx >= 1 ? parts[scratchIdx - 1] : null;
		if (!sessionId) return null;

		const projects = path.join(os.homedir(), '.commandcode', 'projects');
		let dirs: string[];
		try {
			dirs = await fs.readdir(projects);
		} catch {
			return null;
		}
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
				contextLimit = resolveContextWindow(model) ?? 0;
				if (cfg.reasoningEffort?.[model]) effort = cfg.reasoningEffort[model];
			}
		} catch {
			// config.json unavailable; fall through to transcript below
		}

		const files = await locateSessionFiles();
		if (!files) return;

		let meta: {title?: string; model?: string};
		try {
			meta = JSON.parse(await fs.readFile(files.metaPath, 'utf8')) as {title?: string; model?: string};
		} catch {
			return;
		}
		if (meta.title) sessionName = meta.title;
		if (meta.model) {
			model = meta.model;
			contextLimit = resolveContextWindow(model) ?? 0;
		}

		// Scan transcript backwards for the latest assistant entry with model/effort/usage.
		let raw: string;
		try {
			raw = await fs.readFile(files.transcriptPath, 'utf8');
		} catch {
			return;
		}
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
			if (entry.model) {
				model = entry.model;
				contextLimit = resolveContextWindow(model) ?? 0;
			}
			if (entry.effort) effort = entry.effort;
			if (entry.usage) {
				currentTokens = (entry.usage.inputTokens ?? 0) + (entry.usage.outputTokens ?? 0);
				break;
			}
		}
	}

	async function render(): Promise<void> {
		const cwd = (cmd.cwd || '').split(/[\\/]/).filter(Boolean).pop() || cmd.cwd || '';

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

	// Single-flight: every render request chains through one promise so a
	// slower older render can never overwrite a newer one.
	function enqueueRender(): void {
		renderChain = renderChain.then(render).catch(() => {});
	}

	// Single entry point that gathers everything, then renders once.
	async function fullRefresh(): Promise<void> {
		if (refreshing) return;
		refreshing = true;
		try {
			await refreshFromDisk();
			await refreshUsage();
			enqueueRender();
		} finally {
			refreshing = false;
		}
	}

	cmd.on('model_request_start', e => {
		if (e.type === 'model_request_start' && typeof e.model === 'string') {
			model = e.model;
			contextLimit = resolveContextWindow(model) ?? 0;
		}
	});

	cmd.on('model_request_end', e => {
		if (e.type === 'model_request_end') {
			const ev = e as {model?: string; effort?: string; usage?: {inputTokens?: number; outputTokens?: number}};
			if (typeof ev.model === 'string') {
				model = ev.model;
				contextLimit = resolveContextWindow(model) ?? 0;
			}
			if (typeof ev.effort === 'string' && ev.effort) effort = ev.effort;
			if (ev.usage) {
				currentTokens = (ev.usage.inputTokens ?? 0) + (ev.usage.outputTokens ?? 0);
			}
			enqueueRender();
		}
	});

	cmd.on('session_titled', e => {
		if (e.type === 'session_titled' && typeof e.title === 'string') {
			sessionName = e.title;
			enqueueRender();
		}
	});

	cmd.on('config_setting_changed', e => {
		if (e.type === 'config_setting_changed' && e.setting === 'effort' && typeof e.value === 'string') {
			effort = e.value;
			enqueueRender();
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
	const interval = setInterval(() => {
		void (async () => {
			await refreshUsage();
			enqueueRender();
		})();
	}, RENDER_INTERVAL_MS);
	interval.unref?.();
}

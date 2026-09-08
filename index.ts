// cmd-statusline mod.
// Renders one footer segment (setStatus collapses newlines):
//   <cwd>, <branch> <dot>, <session-name> │ <model>, <effort> cntx: N%, usge: N%, wkly: N%, totl: N%, crdt: $N
import type { ModApi } from '@commandcode/harness';
import {
	resolveContextWindow,
	classifyConfigChange,
	debounce,
	DEFAULT_TEMPLATE,
	type Usage,
} from './lib';
import { fetchUsage } from './usage';
import { renderStatus } from './render';

const USAGE_FETCH_THROTTLE_MS = 30_000;
const RENDER_INTERVAL_MS = 30_000;

export default function (cmd: ModApi): void {
	let model = '';
	let effort = '';
	let sessionName = '';
	let currentTokens = 0;
	// 0 = unknown context window. Never retain a stale previous model's window.
	let contextLimit = 0;

	// Configurable format template, read once at factory time.
	cmd.addFlag('statusline_format', { type: 'string', default: DEFAULT_TEMPLATE });
	const template = String(cmd.getFlag('statusline_format') ?? DEFAULT_TEMPLATE);

	// Optional env override for the context window (valid integer > 0).
	const envContextWindow = (() => {
		const raw = process.env.COMMANDCODE_CONTEXT_WINDOW;
		if (!raw) return undefined;
		const n = Number.parseInt(raw, 10);
		return Number.isFinite(n) && n > 0 ? n : undefined;
	})();

	const resolveWindow = (m: string): number =>
		resolveContextWindow(m, undefined, { envOverride: envContextWindow }) ?? 0;

	let usage: Usage | null = null;
	let lastUsageFetch = 0;
	let refreshing = false;
	let renderChain: Promise<void> = Promise.resolve();
	let lastRenderedLine: string | null = null;
	let renderAbort: AbortController | undefined;
	const warn = (msg: string) => {
		try {
			cmd.ui.notify(msg);
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
			const msg =
				err instanceof Error && /401/.test(err.message)
					? 'usage API auth failed'
					: 'usage API unreachable';
			warn(msg);
		}
	}

	// Locate the current session's transcript + meta files on disk.
	async function locateSessionFiles(): Promise<{
		metaPath: string;
		transcriptPath: string;
	} | null> {
		const fs = await import('node:fs/promises');
		const os = await import('node:os');
		const path = await import('node:path');

		// COMMANDCODE_SCRATCHPAD = .../<cwd-slug>/<session-id>/scratchpad
		// Split on either separator — the scratchpad path always uses forward
		// slashes regardless of the host OS.
		const scratch = process.env.COMMANDCODE_SCRATCHPAD;
		if (!scratch) return null;
		const parts = scratch.split(/[\\/]/).filter(Boolean);
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
				return { metaPath, transcriptPath: path.join(projects, d, `${sessionId}.jsonl`) };
			} catch {
				// keep scanning other project dirs
			}
		}
		return null;
	}

	// Read the session title fresh from disk so a manual /rename (which writes
	// to disk but does not emit session_titled) is picked up on the next render.
	async function readTitleFromDisk(): Promise<string> {
		try {
			const fs = await import('node:fs/promises');
			const files = await locateSessionFiles();
			if (!files) return '';
			const meta = JSON.parse(await fs.readFile(files.metaPath, 'utf8')) as {
				title?: string;
			};
			return meta.title ?? '';
		} catch {
			return '';
		}
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
				contextLimit = resolveWindow(model);
				if (cfg.reasoningEffort?.[model]) effort = cfg.reasoningEffort[model];
			}
		} catch {
			// config.json unavailable; fall through to transcript below
		}

		const files = await locateSessionFiles();
		if (!files) return;

		let meta: { title?: string; model?: string };
		try {
			meta = JSON.parse(await fs.readFile(files.metaPath, 'utf8')) as {
				title?: string;
				model?: string;
			};
		} catch {
			return;
		}
		if (meta.title) sessionName = meta.title;
		if (meta.model) {
			model = meta.model;
			contextLimit = resolveWindow(model);
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
			let entry: {
				model?: string;
				effort?: string;
				usage?: { inputTokens?: number; outputTokens?: number };
			};
			try {
				entry = JSON.parse(line);
			} catch {
				continue;
			}
			if (entry.model) {
				model = entry.model;
				contextLimit = resolveWindow(model);
			}
			if (entry.effort) effort = entry.effort;
			if (entry.usage) {
				currentTokens = (entry.usage.inputTokens ?? 0) + (entry.usage.outputTokens ?? 0);
				break;
			}
		}
	}

	// Extract the current session id from COMMANDCODE_SCRATCHPAD.
	function currentSessionId(): string | null {
		const scratch = process.env.COMMANDCODE_SCRATCHPAD;
		if (!scratch) return null;
		const parts = scratch.split(/[\\/]/).filter(Boolean);
		const scratchIdx = parts.lastIndexOf('scratchpad');
		return scratchIdx >= 1 ? parts[scratchIdx - 1] : null;
	}

	async function render(signal?: AbortSignal): Promise<void> {
		const cwd = (cmd.cwd || '').split(/[\\/]/).filter(Boolean).pop() || cmd.cwd || '';

		const files = await locateSessionFiles();

		await renderStatus(
			{
				cwd,
				gitCwd: cmd.cwd,
				branch: '',
				dirty: false,
				sessionName,
				model,
				effort,
				currentTokens,
				contextLimit,
				usage,
				template,
				maxWidth: process.stdout.columns,
				sessionId: currentSessionId(),
				transcriptPath: files?.transcriptPath,
			},
			{
				exec: (args) => cmd.exec({ ...args, signal }),
				readTitle: readTitleFromDisk,
				signal,
				setStatus: (line) => {
					if (line === lastRenderedLine) return;
					lastRenderedLine = line;
					cmd.ui.setStatus(line);
				},
			},
		);
	}

	// Debounced render: coalesces rapid requests into one trailing call, and
	// aborts any in-flight git subprocess before starting a new one.
	const debouncedRender = debounce(() => {
		renderAbort?.abort();
		renderAbort = new AbortController();
		renderChain = renderChain.then(() => render(renderAbort?.signal)).catch(() => {});
	}, 300);

	// Single-flight: every render request chains through one promise so a
	// slower older render can never overwrite a newer one.
	function enqueueRender(): void {
		debouncedRender();
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

	cmd.on('model_request_start', (e) => {
		if (e.type === 'model_request_start' && typeof e.model === 'string') {
			model = e.model;
			contextLimit = resolveWindow(model);
		}
	});

	cmd.on('model_request_end', (e) => {
		if (e.type === 'model_request_end') {
			const ev = e as {
				model?: string;
				effort?: string;
				usage?: { inputTokens?: number; outputTokens?: number };
			};
			if (typeof ev.model === 'string') {
				model = ev.model;
				contextLimit = resolveWindow(model);
			}
			if (typeof ev.effort === 'string' && ev.effort) effort = ev.effort;
			if (ev.usage) {
				currentTokens = (ev.usage.inputTokens ?? 0) + (ev.usage.outputTokens ?? 0);
			}
			enqueueRender();
		}
	});

	cmd.on('session_titled', (e) => {
		if (e.type === 'session_titled' && typeof e.title === 'string') {
			sessionName = e.title;
			enqueueRender();
		}
	});

	cmd.on('config_setting_changed', (e) => {
		if (e.type !== 'config_setting_changed') return;
		const kind = classifyConfigChange(e.setting, e.value);
		if (kind === 'model') {
			model = e.value as string;
			contextLimit = resolveWindow(model);
			enqueueRender();
		} else if (kind === 'effort') {
			effort = e.value as string;
			enqueueRender();
		}
	});

	cmd.hooks({
		onSessionStart: () => {
			void fullRefresh();
		},
		onSessionEnd: () => {
			debouncedRender.cancel();
			renderAbort?.abort();
			cmd.ui.setStatus(null);
			lastRenderedLine = null;
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

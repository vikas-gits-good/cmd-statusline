// I/O helpers for the status line, extracted from index.ts so their error
// paths are unit-testable with injected fetch/env/fs dependencies.
import type { Usage } from './lib';

export const API_BASE = 'https://api.commandcode.ai';
export const CLIENT_VERSION = '1.50.0';
export const USAGE_FETCH_TIMEOUT_MS = 10_000;

export interface UsageDeps {
	fetchFn?: typeof fetch;
	env?: NodeJS.ProcessEnv;
	homeDir?: string;
	readFile?: (path: string) => Promise<string>;
}

export async function readAuthKey(deps: UsageDeps = {}): Promise<string | null> {
	const env = deps.env ?? process.env;
	const fromEnv = env.COMMAND_CODE_API_KEY?.trim();
	if (fromEnv) return fromEnv;

	try {
		const os = await import('node:os');
		const path = await import('node:path');
		const home = deps.homeDir ?? os.homedir();
		const p = path.join(home, '.commandcode', 'auth.json');
		const raw = deps.readFile
			? await deps.readFile(p)
			: await (await import('node:fs/promises')).readFile(p, 'utf8');
		const parsed = JSON.parse(raw) as { apiKey?: string };
		return parsed.apiKey ?? null;
	} catch {
		return null;
	}
}

export async function fetchUsage(deps: UsageDeps = {}): Promise<Usage | null> {
	const key = await readAuthKey(deps);
	if (!key) return null;

	const fetchFn = deps.fetchFn ?? fetch;
	const headers = {
		Authorization: `Bearer ${key}`,
		'Content-Type': 'application/json',
		'User-Agent': 'cli',
		'x-cli-environment': 'cli',
		'x-command-code-version': CLIENT_VERSION,
	};

	const fetchJson = async (url: string) => {
		const res = await fetchFn(url, {
			headers,
			signal: AbortSignal.timeout(USAGE_FETCH_TIMEOUT_MS),
		});
		if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
		return res.json();
	};

	const [creditsJson, subJson] = (await Promise.all([
		fetchJson(`${API_BASE}/alpha/billing/credits`),
		fetchJson(`${API_BASE}/alpha/billing/subscriptions`),
	])) as [
		{
			credits: { monthlyCredits?: number; purchasedCredits?: number; freeCredits?: number };
			windowLimits: {
				fiveHour?: { used?: number; cap?: number };
				weekly?: { used?: number; cap?: number };
			};
		},
		{ data?: { planId?: string; currentPeriodStart?: string } },
	];

	const planId = subJson.data?.planId ?? '';
	const since = subJson.data?.currentPeriodStart ?? undefined;
	const summaryPath = `${API_BASE}/alpha/usage/summary${since ? `?since=${encodeURIComponent(since)}` : ''}`;
	const summaryJson = (await fetchJson(summaryPath)) as { totalCost?: number };

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

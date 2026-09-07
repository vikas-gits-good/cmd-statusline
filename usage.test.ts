import {describe, it, expect} from 'vitest';
import {readAuthKey, fetchUsage, API_BASE, CLIENT_VERSION} from './usage';

function jsonRes(body: unknown, ok = true, status = 200): Response {
	return {
		ok,
		status,
		statusText: ok ? 'OK' : 'Internal Server Error',
		json: async () => body,
	} as unknown as Response;
}

describe('readAuthKey', () => {
	it('returns the env var when set', async () => {
		expect(await readAuthKey({env: {COMMAND_CODE_API_KEY: 'abc123'}})).toBe('abc123');
	});

	it('returns null when no env var and no auth file', async () => {
		expect(await readAuthKey({env: {}, homeDir: '/nonexistent', readFile: async () => { throw new Error('ENOENT'); }})).toBeNull();
	});

	it('returns the key from auth.json', async () => {
		const key = await readAuthKey({
			env: {},
			homeDir: '/home/u',
			readFile: async () => JSON.stringify({apiKey: 'file-key'}),
		});
		expect(key).toBe('file-key');
	});

	it('returns null for malformed auth.json', async () => {
		expect(await readAuthKey({env: {}, homeDir: '/home/u', readFile: async () => 'not json'})).toBeNull();
	});
});

describe('fetchUsage', () => {
	it('returns null when no auth key', async () => {
		expect(await fetchUsage({env: {}, homeDir: '/nonexistent', readFile: async () => { throw new Error('x'); }})).toBeNull();
	});

	it('returns parsed usage from healthy API responses', async () => {
		const credits = {
			credits: {monthlyCredits: 30, purchasedCredits: 0, freeCredits: 0},
			windowLimits: {fiveHour: {used: 5, cap: 16}, weekly: {used: 20, cap: 40}},
		};
		const sub = {data: {planId: 'individual-pro', currentPeriodStart: '2026-01-01'}};
		const summary = {totalCost: 15};
		const calls: string[] = [];
		const fetchFn = async (url: string) => {
			calls.push(url);
			if (url.includes('/credits')) return jsonRes(credits);
			if (url.includes('/subscriptions')) return jsonRes(sub);
			if (url.includes('/summary')) return jsonRes(summary);
			throw new Error('unexpected ' + url);
		};
		const u = await fetchUsage({env: {COMMAND_CODE_API_KEY: 'k'}, fetchFn: fetchFn as typeof fetch});
		expect(u).toEqual({
			planId: 'individual-pro',
			fiveHourUsed: 5,
			fiveHourCap: 16,
			weeklyUsed: 20,
			weeklyCap: 40,
			monthlyCredits: 30,
			purchasedCredits: 0,
			freeCredits: 0,
			totalSpent: 15,
		});
		expect(calls).toContain(`${API_BASE}/alpha/billing/credits`);
	});

	it('throws on a non-OK (500) response', async () => {
		const fetchFn = async () => jsonRes({}, false, 500);
		await expect(fetchUsage({env: {COMMAND_CODE_API_KEY: 'k'}, fetchFn: fetchFn as typeof fetch})).rejects.toThrow('500');
	});

	it('throws on a 401 response (expired key)', async () => {
		const fetchFn = async () => jsonRes({}, false, 401);
		await expect(fetchUsage({env: {COMMAND_CODE_API_KEY: 'k'}, fetchFn: fetchFn as typeof fetch})).rejects.toThrow('401');
	});

	it('throws on network failure', async () => {
		const fetchFn = async () => { throw new Error('network down'); };
		await expect(fetchUsage({env: {COMMAND_CODE_API_KEY: 'k'}, fetchFn: fetchFn as typeof fetch})).rejects.toThrow('network down');
	});

	it('defaults missing usage fields to 0', async () => {
		const fetchFn = async (url: string) => {
			if (url.includes('/credits')) return jsonRes({credits: {}, windowLimits: {}});
			if (url.includes('/subscriptions')) return jsonRes({});
			return jsonRes({});
		};
		const u = await fetchUsage({env: {COMMAND_CODE_API_KEY: 'k'}, fetchFn: fetchFn as typeof fetch});
		expect(u?.fiveHourUsed).toBe(0);
		expect(u?.totalSpent).toBe(0);
		expect(u?.planId).toBe('');
	});

	it('includes client version header in requests', async () => {
		let capturedHeaders: Record<string, string> | undefined;
		const fetchSeq = async (url: string, init?: RequestInit) => {
			capturedHeaders = init?.headers as Record<string, string>;
			if (url.includes('/credits')) return jsonRes({credits: {}, windowLimits: {}});
			if (url.includes('/subscriptions')) return jsonRes({});
			return jsonRes({});
		};
		await fetchUsage({env: {COMMAND_CODE_API_KEY: 'k'}, fetchFn: fetchSeq as typeof fetch});
		expect(capturedHeaders?.['x-command-code-version']).toBe(CLIENT_VERSION);
	});
});

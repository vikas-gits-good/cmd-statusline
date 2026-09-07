import { describe, it, expect } from 'vitest';
import { renderStatus, type RenderDeps, type RenderInput } from '../render';

function input(overrides: Partial<RenderInput> = {}): RenderInput {
	return {
		cwd: 'repo',
		branch: '',
		dirty: false,
		sessionName: '',
		model: 'deepseek/deepseek-v4-pro',
		effort: 'high',
		currentTokens: 0,
		contextLimit: 1_000_000,
		usage: null,
		...overrides,
	};
}

function deps(
	overrides: Partial<RenderDeps> = {},
): RenderDeps & { setStatusCalls: (string | null)[] } {
	const setStatusCalls: (string | null)[] = [];
	return {
		exec: async () => ({ stdout: 'main\n', stderr: '', code: 0 }),
		readTitle: async () => '',
		signal: undefined,
		setStatus: (line) => setStatusCalls.push(line),
		...overrides,
		setStatusCalls,
	} as RenderDeps & { setStatusCalls: (string | null)[] };
}

describe('renderStatus (graceful degradation)', () => {
	it('renders a normal line and calls setStatus once', async () => {
		const d = deps();
		await renderStatus(input(), d);
		expect(d.setStatusCalls).toHaveLength(1);
		expect(d.setStatusCalls[0]).toContain('repo');
	});

	it('renders a normal line (not a placeholder) when git exec throws (non-fatal)', async () => {
		const d = deps({
			exec: async () => {
				throw new Error('git not found');
			},
		});
		await renderStatus(input(), d);
		expect(d.setStatusCalls).toHaveLength(1);
		expect(d.setStatusCalls[0]).not.toBe('--');
		expect(d.setStatusCalls[0]).toContain('repo');
	});

	it('calls setStatus("--") exactly once on a fatal internal error', async () => {
		const d = deps({
			readTitle: async () => {
				throw new Error('disk read exploded');
			},
		});
		await renderStatus(input(), d);
		expect(d.setStatusCalls).toEqual(['--']);
	});

	it('does NOT call setStatus when the signal is aborted', async () => {
		const controller = new AbortController();
		controller.abort();
		const d = deps({ signal: controller.signal });
		await renderStatus(input(), d);
		expect(d.setStatusCalls).toHaveLength(0);
	});

	it('returns early when signal becomes aborted after the git exec succeeds', async () => {
		const controller = new AbortController();
		const d = deps({
			signal: controller.signal,
			exec: async () => {
				// Signal is still not aborted during exec; abort after it resolves.
				controller.abort();
				return { stdout: 'main\n', stderr: '', code: 0 };
			},
		});
		await renderStatus(input(), d);
		expect(d.setStatusCalls).toHaveLength(0);
	});

	it('does NOT call setStatus when exec is aborted mid-flight', async () => {
		const controller = new AbortController();
		const d = deps({
			signal: controller.signal,
			exec: async ({ signal }) => {
				// Simulate an aborted git call.
				if (signal?.aborted) throw new Error('aborted');
				throw new Error('aborted');
			},
		});
		// Abort before render checks the signal.
		controller.abort();
		await renderStatus(input(), d);
		expect(d.setStatusCalls).toHaveLength(0);
	});
});

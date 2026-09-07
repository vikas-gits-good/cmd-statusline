// Injectable render body, extracted from index.ts so error paths are
// unit-testable. Mirrors usage.ts's UsageDeps pattern.
import {
	renderTemplate,
	DEFAULT_TEMPLATE,
	normalizeBranch,
	pickSessionName,
	type Usage,
} from './lib';

export interface RenderInput {
	// Display basename (last path component) shown in {cwd}.
	cwd: string;
	// Absolute working directory used for git. Defaults to cwd when omitted.
	gitCwd?: string;
	branch: string;
	dirty: boolean;
	sessionName: string;
	model: string;
	effort: string;
	currentTokens: number;
	contextLimit: number;
	usage: Usage | null;
	template?: string;
	maxWidth?: number;
}

export interface ExecResult {
	stdout: string;
	stderr: string;
	code: number;
}

export interface RenderDeps {
	exec: (args: {
		command: string;
		args?: string[];
		cwd?: string;
		signal?: AbortSignal;
	}) => Promise<ExecResult>;
	readTitle: () => Promise<string>;
	signal?: AbortSignal;
	setStatus: (line: string | null) => void;
}

// Render the status line. Guarantees:
//   - never throws (returns a placeholder on any internal failure)
//   - never calls setStatus when the signal is already aborted
//   - calls setStatus exactly once per invocation on success
export async function renderStatus(input: RenderInput, deps: RenderDeps): Promise<void> {
	if (deps.signal?.aborted) return;

	try {
		const gitCwd = input.gitCwd ?? input.cwd;
		let branch = input.branch;
		let dirty = input.dirty;

		try {
			const b = await deps.exec({
				command: 'git',
				args: ['rev-parse', '--abbrev-ref', 'HEAD'],
				cwd: gitCwd,
				signal: deps.signal,
			});
			branch = normalizeBranch(b.stdout);
			const s = await deps.exec({
				command: 'git',
				args: ['status', '--porcelain'],
				cwd: gitCwd,
				signal: deps.signal,
			});
			dirty = s.stdout.trim().length > 0;
		} catch {
			// not a git repo — keep the passed-in branch/dirty
		}

		if (deps.signal?.aborted) return;

		const diskTitle = await deps.readTitle();
		const resolvedSessionName = pickSessionName(diskTitle, input.sessionName);

		const line = renderTemplate(
			input.template ?? DEFAULT_TEMPLATE,
			{
				cwd: input.cwd,
				branch,
				dirty,
				sessionName: resolvedSessionName,
				model: input.model,
				effort: input.effort,
				currentTokens: input.currentTokens,
				contextLimit: input.contextLimit,
				usage: input.usage,
			},
			input.maxWidth,
		);

		deps.setStatus(line);
	} catch {
		// Any internal failure (bad usage shape, buildStatusLine edge case)
		// degrades to a stable placeholder rather than crashing the mod.
		deps.setStatus('--');
	}
}

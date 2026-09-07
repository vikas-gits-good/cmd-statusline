// Minimal ambient type shim for the Command Code harness. The real module is
// bundled into the `cmd` CLI and resolved at runtime via jiti; this only exists
// so `tsc --noEmit` can typecheck the mod in isolation.
declare module '@commandcode/harness' {
	export interface ModApi {
		name: string;
		cwd: string;
		ui: {
			notify(message: string): void;
			setStatus(text: string | null): unknown;
		};
		session?: {
			getCustomEntries(args: {
				customType: string;
			}): Promise<Array<{ id: string; customType: string; data?: unknown }>>;
			appendCustomEntry(args: { customType: string; data: unknown }): Promise<unknown>;
		};
		sessions: {
			tree(): Array<{ id: string; label?: string; children?: unknown[] }>;
		};
		exec(args: {
			command: string;
			args?: string[];
			cwd?: string;
			signal?: AbortSignal;
		}): Promise<{ stdout: string; stderr: string; code: number }>;
		addFlag(
			name: string,
			opts: { type: 'boolean' | 'string'; default?: unknown; description?: string },
		): unknown;
		getFlag(name: string): boolean | string | undefined;
		hooks(hooks: Record<string, (...args: any[]) => any>): unknown;
		on(event: string, handler: (event: any) => void): unknown;
	}
}

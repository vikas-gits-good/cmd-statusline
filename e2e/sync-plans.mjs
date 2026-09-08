#!/usr/bin/env node
// Sync the plan→credits and plan→display-name maps from the installed
// Command Code binary into e2e/plans.list.json. Run before plan tests so
// credit changes are picked up automatically.
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const outFile = join(here, 'plans.list.json');

function resolveCliBundle() {
	// `which cmd` → /opt/homebrew/bin/cmd → symlink to .../dist/index.mjs,
	// which dynamically imports ./cli.mjs in the same directory.
	const which = execFileSync('which', ['cmd'], { encoding: 'utf8' }).trim();
	const resolved = realpathSync(which);
	return join(dirname(resolved), 'cli.mjs');
}

// The plan maps are minified, so their variable names change between CLI
// builds. Anchor on stable plan content instead: find the first flat object
// literal containing `needle`, then walk braces to its matching close.
function extractObjectContaining(src, needle) {
	const at = src.indexOf(needle);
	if (at < 0) throw new Error(`could not find ${JSON.stringify(needle)} in CLI bundle`);
	const open = src.lastIndexOf('{', at);
	if (open < 0) throw new Error(`no opening brace before ${JSON.stringify(needle)}`);
	let depth = 0;
	for (let i = open; i < src.length; i++) {
		const ch = src[i];
		if (ch === '{') depth++;
		else if (ch === '}') {
			depth--;
			if (depth === 0) return JSON.parse(src.slice(open, i + 1));
		}
	}
	throw new Error(`unbalanced braces while extracting ${JSON.stringify(needle)}`);
}

const cliPath = resolveCliBundle();
const src = readFileSync(cliPath, 'utf8');

// `"individual-go":` (no trailing quote) matches the numeric credits map, not
// the string display-name or object-shaped category maps.
const credits = extractObjectContaining(src, '"individual-go":');
const displayNames = extractObjectContaining(src, '"individual-go":"Go"');

// Sanity-check: every credit key must resolve to a positive number, and the
// display-name map must be non-empty. A wrong match would fail here.
const entries = Object.entries(credits);
if (entries.length < 2) throw new Error('sync-plans: extracted too few plans');
for (const [id, amount] of entries) {
	if (typeof amount !== 'number' || amount <= 0) {
		throw new Error(`sync-plans: invalid credits for ${id}: ${amount}`);
	}
}

const plans = Object.keys(credits)
	.sort()
	.map((id) => ({
		id,
		name: displayNames[id] ?? id,
		monthlyCredits: credits[id],
	}));

writeFileSync(
	outFile,
	JSON.stringify({ generatedAt: new Date().toISOString(), plans }, null, 2) + '\n',
);
console.log(`synced ${plans.length} plans -> ${outFile}`);

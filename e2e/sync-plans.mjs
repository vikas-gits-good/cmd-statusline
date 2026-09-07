#!/usr/bin/env node
// Sync the plan→credits and plan→display-name maps from the installed
// Command Code binary into e2e/plans.list.json. Run before plan tests so
// credit changes are picked up automatically.
import {readFileSync, writeFileSync, realpathSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const outFile = join(here, 'plans.list.json');

function resolveCliBundle() {
	// `which cmd` → /opt/homebrew/bin/cmd → symlink to .../dist/index.mjs,
	// which dynamically imports ./cli.mjs in the same directory.
	const which = execFileSync('which', ['cmd'], {encoding: 'utf8'}).trim();
	const resolved = realpathSync(which);
	return join(dirname(resolved), 'cli.mjs');
}

function extractMap(src, varName) {
	// Zn={"individual-go":10,...}  er={...}
	const re = new RegExp(varName + '=\\{([^}]*)\\}');
	const m = src.match(re);
	if (!m) throw new Error(`could not find ${varName} in CLI bundle`);
	const raw = `{${m[1]}}`;
	return JSON.parse(raw);
}

const cliPath = resolveCliBundle();
const src = readFileSync(cliPath, 'utf8');

const credits = extractMap(src, 'Zn');
const displayNames = extractMap(src, 'er');

const plans = Object.keys(credits).sort().map(id => ({
	id,
	name: displayNames[id] ?? id,
	monthlyCredits: credits[id],
}));

writeFileSync(
	outFile,
	JSON.stringify({generatedAt: new Date().toISOString(), plans}, null, 2) + '\n',
);
console.log(`synced ${plans.length} plans -> ${outFile}`);

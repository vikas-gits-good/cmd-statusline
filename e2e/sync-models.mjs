#!/usr/bin/env node
// Sync the model list AND the authoritative context-window map from the
// installed Command Code binary. Run before the Playwright model suite so
// new models (and their context windows) are picked up automatically.
import {execFileSync} from 'node:child_process';
import {writeFileSync, readFileSync, realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join, dirname} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outFile = join(here, 'models.list.json');
const contextFile = join(here, 'context-windows.json');

function resolveCliBundle() {
	const which = execFileSync('which', ['cmd'], {encoding: 'utf8'}).trim();
	const resolved = realpathSync(which);
	return join(dirname(resolved), 'cli.mjs');
}

function extractMap(src, varName) {
	// Tr=new Map([[...],[...],...])
	// Match the whole `new Map([ ... ])` body by taking everything up to the
	// first "])" that closes the outer array (the inner arrays don't contain
	// "])" because they're followed by a comma or the map's closing paren).
	const re = new RegExp('\\b' + varName + '=new Map\\(\\[([\\s\\S]*?)\\]\\)');
	const m = src.match(re);
	if (!m) throw new Error(`could not find ${varName} in CLI bundle`);
	const raw = `[${m[1]}]`;
	return JSON.parse(raw);
}

function parseModels(text) {
	const models = [];
	const seen = new Set();
	// Exact section headers and non-model help lines to skip.
	const skipExact = new Set([
		'open source', 'anthropic', 'openai', 'google', 'sakana', 'meta', 'xai',
		'available models', 'pass the full id', 'docs:', 'cmd --model',
	]);
	for (const line of text.split('\n')) {
		// Model lines: left column is the model id, then ≥2 spaces before the description.
		const m = line.match(/^\s*([a-z0-9][a-z0-9._/-]*)\s{2,}/i);
		if (!m) continue;
		const id = m[1].toLowerCase();
		// Section headers are short tokens with no slash and match known headers.
		if (skipExact.has(id) && !id.includes('/')) continue;
		if (seen.has(id)) continue;
		seen.add(id);
		models.push(id);
	}
	return models;
}

const raw = execFileSync('cmd', ['--list-models'], {encoding: 'utf8', maxBuffer: 10 * 1024 * 1024});
const models = parseModels(raw);

// A healthy CLI exposes dozens of models. If parsing yields fewer, the CLI
// output format changed — fail loudly instead of silently generating zero
// tests.
const MIN_MODELS = 20;
if (models.length < MIN_MODELS) {
	throw new Error(`sync-models: parsed only ${models.length} models (expected ≥${MIN_MODELS}); CLI output format likely changed`);
}

// Sanity-check IDs look like provider/model or short-name.
const bad = models.filter(id => !/^[a-z0-9][a-z0-9._/-]*$/.test(id));
if (bad.length > 0) {
	throw new Error(`sync-models: invalid model ids: ${bad.join(', ')}`);
}

writeFileSync(outFile, JSON.stringify({generatedAt: new Date().toISOString(), models}, null, 2) + '\n');
console.log(`synced ${models.length} models -> ${outFile}`);

// Also extract the authoritative context-window map (Tr) from the CLI bundle.
const cliPath = resolveCliBundle();
const cliSrc = readFileSync(cliPath, 'utf8');
const pairs = extractMap(cliSrc, 'Tr');
const windows = {};
for (const [id, limit] of pairs) {
	windows[id] = Number(limit);
}
const resolvedIds = Object.keys(windows);
if (resolvedIds.length < 20) {
	throw new Error(`sync-models: extracted too few context windows (${resolvedIds.length})`);
}
writeFileSync(contextFile, JSON.stringify({generatedAt: new Date().toISOString(), windows}, null, 2) + '\n');
console.log(`synced ${resolvedIds.length} context windows -> ${contextFile}`);

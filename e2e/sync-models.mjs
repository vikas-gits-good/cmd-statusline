#!/usr/bin/env node
// Sync the model list from `cmd --list-models` into e2e/models.list.json.
// Run before the Playwright model suite so new models are picked up automatically.
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join, dirname} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outFile = join(here, 'models.list.json');

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
writeFileSync(outFile, JSON.stringify({generatedAt: new Date().toISOString(), models}, null, 2) + '\n');
console.log(`synced ${models.length} models -> ${outFile}`);

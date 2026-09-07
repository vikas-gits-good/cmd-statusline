# cmd-statusline

A Command Code mod that renders a persistent status bar under the input panel:

![statusline](statusline.png)

- `<project>` — current working directory basename
- `<branch>` — git branch (green dot = clean, orange dot = uncommitted changes)
- `<session-name>` — chat session title (survives `/reload`)
- `<model>` / `<effort>` — current model and reasoning effort
- `cntx` — context-fill estimate
- `usge` / `wkly` — 5-hour and weekly usage limits
- `totl` — billing-cycle usage
- `crdt` — remaining credits, color-coded by plan (green ≥50%, yellow 25–49%, orange 10–24%, red <10%)

Percentages are color-coded by severity. Usage data comes from the Command Code API using the same auth the CLI uses (`~/.commandcode/auth.json`).

## Install

```bash
cmd mods add vikas-gits-good/cmd-statusline -g
```

## Development

Prerequisites: Node.js 22+, `cmd` on PATH (the sync scripts read model/plan data from the installed CLI).

```bash
npm ci                # NODE_ENV=development required (npm omits dev deps otherwise)
npm run test:unit     # vitest (unit + pure logic)
npm run test:e2e      # sync model/plan lists, build harness, run Playwright
```

The E2E suite auto-syncs the live model list and plan credits from `cmd` before running, so new models/plans are covered automatically. Five models are intentionally skipped because the Command Code CLI's own context-window map lacks them; the mod renders their `cntx` as `--`.

## License

MIT

---

Built with [Command Code](https://commandcode.ai).

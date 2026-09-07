# cmd-statusline

A Command Code mod that renders a persistent status bar under the input panel:

![statusline](statusline.png)

- `<project>` — current working directory basename
- `<branch>` — git branch (green dot = clean, orange dot = uncommitted changes)
- `<session-name>` — chat session title (survives `/reload`)
- `<model>` / `<effort>` — current model and reasoning effort
- `ctx` — context-fill estimate
- `usg` / `wkl` — 5-hour and weekly usage limits
- `tot` — billing-cycle usage
- `crd` — remaining credits, color-coded by plan (green ≥50%, yellow 25–49%, orange 10–24%, red <10%)

Percentages are color-coded by severity. Usage data comes from the Command Code API using the same auth the CLI uses (`~/.commandcode/auth.json`).

## Install

```bash
cmd mods add vikas-gits-good/cmd-statusline -g
```

## License

MIT

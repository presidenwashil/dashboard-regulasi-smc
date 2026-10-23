# Environment quirks: this machine's shell stack

Facts about the tooling environment that cost real tool calls when unknown.
Read once per session; JSON-copy nothing — these are stable.

## The rtk harness swallows stdout

A wrapped harness intercepts shell I/O. Anything piped through a second
command risks coming back empty — don't re-run impatiently, redirect instead:
for stderr-only capture use `2>&1 1>$null | Out-String`; combine with stdout
drops deliberately. For tests this doesn't matter anymore: every `vitest run`
leaves the machine-readable report at `./.vitest/json/output.json`
(configured in `vite.config.ts`; `.vitest/` is gitignored). Parse with
`node -e "const r=require('./.vitest/json/output.json'); ..."`.

`tsc -b` and `oxlint` stdout pass through fine.

## pwsh, not bash

- Quote `"@me"` in `gh` args (`gh issue edit 3 --add-assignee "@me"`);
  unquoted, pwsh splats it.
- No `tail`: use `Select-Object -Last n` or end pipelines with
  `Out-String -Width 250`.
- Long commands: set an explicit `timeout`; networkish commands (`clasp
  versions`) can hang past the default.

## `bash` on PATH is WSL

- It takes **unix paths only** (`/mnt/c/Users/...`), never `C:\...`.
- WSL bash cannot reach this repo's Windows `npm`/`clasp` installs; anything
  that runs repo tooling stays in pwsh.
- Interactive scripts that block on human input (wizards) never run from an
  agent shell: hand the human the exact `/mnt/c/...` command in a code block
  and wait for their confirmation instead.

## Spawning commands from Node scripts on Windows

`spawnSync('cmd', args, { shell: true })` joins args unquoted — multi-word
args (`-d "a b c"`) become separate words of the child command. Use
`scripts/lib/spawn.mjs` (`runCommand`), which quotes for `cmd.exe` on win32.

## Clasp CLI (Apps Script), run from `../bank-dokumen`

The sibling repo's `.clasp.json` carries the project id; run `clasp` there
(`scripts/ship*.mjs` already do). Command map learned by trial:

- `clasp deployments` — list deployments. The word `list` is **not** a
  subcommand (it becomes a stray scriptId argument → "Invalid ID").
- `clasp redeploy <deploymentId> -d "<description>"` — point an existing
  deployment at a new version; bare form creates that version from HEAD.
- `clasp deploy` — create a **new** deployment (what `ship:setup` does).
- `clasp show-authorized-user` — cheap auth-state probe.
- `clasp <anything>` errors with a Google-side message when the machine's
  account hasn't enabled the Apps Script API
  (script.google.com/home/usersettings, human-only browser toggle; see
  `docs/ship.md`).

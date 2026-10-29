# Ship pipeline

Established by the ship-pipeline slice (ticket #3). The bridge from this repo's
build output to the real Apps Script project — the path every later feature
slice uses for real-GAS verification. Decisions behind it: `docs/adr/0001`
(backend vendored in this repo's `gas/`, clasp bridge) and `docs/adr/0003`
(version-pin isolation).

## What `npm run ship` does

Runs, in order, halting at the **first failing step** with a clear report:

1. **typecheck** (`npm run typecheck`, `tsc -b`)
2. **lint** (`npm run lint`, oxlint)
3. **tests** (`npm run test`, the full Vitest suite)
4. **build** (`npm run build`, single-file `dist/index.html`, already copied
   to `gas/Index.html` by the build)
5. **copy artifact** — overwrites `gas/Index.html` (belt-and-braces; the
   build itself already copied it)
6. **clasp push** — from the repo root (the root `.clasp.json` points at `gas/`)
7. **redeploy verification** — `clasp redeploy <id> -d …`, where `<id>` comes
   from `ship.config.json`

Any failing gate stops the pipeline before the first side effect (build → copy
→ push → redeploy). **Production is never touched by ship**: its deployment
stays pinned to the vanilla version for the whole migration
(ADR-0003); only the verification deployment is redeployed, to a fresh version,
keeping its identity and URL.

Orchestration lives in `scripts/ship.mjs`, pinned by
`scripts/ship.test.mjs` (gate order, halt-on-failure, exact copy/clasp usage).
Windows-safe command spawning is shared via `scripts/lib/spawn.mjs`.

## One-time setup (`npm run ship:setup`)

Provisioned once from any machine that will ship; `scripts/ship-setup.mjs`:

1. Verifies clasp is authenticated (`clasp show-authorized-user`).
2. Creates a **NEW** deployment in the Apps Script project — the verification
   deployment. It never lists, edits, or matches existing deployments, so it
   cannot touch production.
3. Writes the deployment id to `ship.config.json` (committed; the id is not a
   secret) and opens the web app.

Human-only prerequisites, if missing, the script says exactly what to do:

- **clasp login** — browser OAuth flow, run manually: `clasp login` (from the
  repo root), then re-run setup.
- **Apps Script API enabled** — `clasp` reports it; toggle at
  `https://script.google.com/home/usersettings`, wait ~30 s for propagation,
  re-run setup. (Google account-wide setting; once is enough.)

Re-running setup is safe and idempotent: an existing `ship.config.json` is
kept as-is.

## Production identification (`npm run release:setup`, ticket #13)

One-time (per repo) identification of the **production deployment**; run from
an interactive terminal. `scripts/release-setup.mjs`:

1. Reads the verification id from `ship.config.json` (ship must be set up
   first — `npm run ship:setup`).
2. Lists the Apps Script deployments (`clasp deployments`, read-only) with
   version + description, and asks the human which deployment the stable
   production URL serves — the one pinned to the vanilla version (ADR-0003).
   Nothing selects it automatically: it is a one-way-door identity decision.
3. Refuses a few traps by design: an id clasp did not list (typo), the
   verification deployment itself, and a non-interactive shell (the choice
   belongs to a human; agents cannot answer interactive blockers from a shell).
4. Writes `productionDeploymentId` into `ship.config.json` (committed next to
   the verification id, the id is not a secret).

Re-running it is safe: it only overwrites this one choice.

## The cutover (`npm run release`)

Deliberate, human-authorized production switch (ticket #13; the deployment
table above is its contract). `scripts/release.mjs`, pinned by
`scripts/release.test.mjs`:

1. **Preflight**: refuses to run at all in a non-interactive shell — no gates,
   no push, no redeploy. There is no auto-release path.
2. **Ship gates and artifact**: the same ordered steps as `npm run ship` up
   through `clasp push` (typecheck → lint → full test suite → build → copy →
   push), halting at the first failure exactly like ship.
3. **Explicit confirmation**: prints exactly what is about to happen (which
   deployment, same URL, cutover semantics) and requires typing `y`/`yes`;
   anything else aborts before the redeploy and production stays untouched.
4. **Production redeploy**: `clasp redeploy <production-deployment-id> …
   --json` — the **only** clasp command here that touches production. It
   creates a new version from the freshly pushed HEAD and repoints the
   existing deployment, preserving its id and URL (ADR-0003).
5. **Version print**: parses the redeploy's JSON result and prints the new
   version production now serves.

After the flip, users open the same stable URL and get the React app. The
verification deployment is untouched by release (it belongs to `ship`).

## Verification vs production during migration (ADR-0003)

| Deployment | Serves | Changed by |
| --- | --- | --- |
| **verification** (`ship.config.json`) | latest shipped React build | every `npm run ship` |
| **production** (`ship.config.json` → `productionDeploymentId`) | pinned version; the vanilla app until cutover, the React build after `npm run release` | only `npm run release`, which is explicit and interactive |

Real-GAS verification per feature slice (see spec #1 Testing Decisions): open
the verification URL and run the slice's checklist (authentication,
authorization, session behavior, server integration) before release. The
first slice's checklist: app shell loads inside the GAS sandbox with no CDN
gaps.

## Generated output in this repo

After ship, `gas/Index.html` is generated (the React build). It is gitignored
here — hand edits to it will be overwritten by the next ship; the backend
logic lives in the `gas/*.gs` sources, which are edited and committed directly.

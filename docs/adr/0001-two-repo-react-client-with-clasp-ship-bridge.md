# One repo: client and GAS backend (gas/), pushed via the root `clasp.json`

> **Revised** (Oct 2026): this ADR originally described a two-repo layout with
> the GAS app in the sibling `../bank-dokumen`. The human "re-code from
> scratch" decision vendored the Apps Script backend into this repo as `gas/`
> (committed in the re-code); the sibling repo is retired. The wording below
> has been updated to match; the ship/release decisions (with ADR-0003) are
> unchanged.

The Apps Script backend lives **in this repo**, in `gas/`: in-sandbox code
(`*.gs` sources + the generated `Index.html`) that can't be developed with the
client's tooling. We decided: the Vite + React + TypeScript client lives in
this repo; a build produces a **single self-contained HTML file**
(vite-plugin-singlefile) copied to `gas/Index.html`, and `npm run ship`
validates, builds, and runs `clasp push` from the repo root — the root
`.clasp.json` points at `gas/`. clasp auth stays local to the developer's
machine; GitHub Actions is deferred until a demonstrated need. Deployment
versioning is handled explicitly by the ship/release flow — `clasp push` alone
does not move a production deployment (ADR-0003).

## Considered options

- **Keep a separate GAS repo** (the original `../bank-dokumen` layout) —
  rejected after the re-code: it left three drifting copies of the backend
  (sibling, `gas/`, the deployed script) and two competing push paths; the
  backend the client's tests must mirror should live beside the code that
  mirrors it.
- **GitHub Actions CI from day one** — deferred; add when the pain appears.

## Consequences

- `gas/Index.html` is generated output (gitignored) — hand edits will be
  overwritten by the next ship; backend logic is edited and committed in the
  `gas/*.gs` sources.
- Canonical domain docs (GLOSSARY.md, docs/adr/) and the backend live in the
  same repo.
- Every feature must be verified against the real Apps Script environment
  before release; the ship flow includes validation and a verification
  deployment (ADR-0003).

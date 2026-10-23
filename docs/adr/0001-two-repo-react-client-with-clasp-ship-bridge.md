# React client in this repo; GAS repo (bank-dokumen) shipped to via clasp

The Apps Script app (`../bank-dokumen`) is vanilla in-sandbox code (`Code.js` +
`Index.html`) that can't be developed with modern tooling. We decided: the Vite +
React + TypeScript client lives in this repo; a build produces a **single
self-contained HTML file** (vite-plugin-singlefile), and `npm run ship` validates,
builds, copies the artifact to `../bank-dokumen/Index.html`, and runs `clasp push`
from that repo. clasp auth stays local to the developer's machine; GitHub Actions is
deferred until a demonstrated need. Deployment versioning is handled explicitly by
the ship/release flow — `clasp push` alone does not move a production deployment.

## Considered options

- **Merge everything into `bank-dokumen`** — rejected: keeps the GAS repo as a
  minimal server/deploy repo and `dashboard-regulasi-smc` as the product repo.
- **GitHub Actions CI from day one** — deferred; add when the pain appears.

## Consequences

- Once parity is reached, `bank-dokumen/Index.html` is generated output — hand edits
  there will be overwritten. Before cutover, the vanilla file stays deployable.
- Canonical domain docs (GLOSSARY.md, docs/adr/) live in this repo;
  `bank-dokumen/AGENTS.md` points here.
- Every feature must be verified against the real Apps Script environment before
  release; the ship flow includes validation.

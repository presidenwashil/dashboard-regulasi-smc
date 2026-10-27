# Dashboard Regulasi - React client

The Vite + React + TypeScript client **and** the Apps Script backend
(`gas/`) for the Dashboard Regulasi RS Samarinda Medika Citra hospital app,
replatforming the vanilla Apps Script app it replaced (the parity baseline).

Canonical docs live here: `GLOSSARY.md` (domain language), `docs/adr/`
(platform decisions), `docs/testing.md` (test conventions), `AGENTS.md` (agent
guidance). The replatform spec and its tickets live as GitHub issues.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | HMR dev server against the **mock backend** (seeded demo data; Admin/User role switcher in the bottom-right) |
| `npm run build` | Typecheck + single-file self-contained production build (`dist/index.html`) |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | oxlint |
| `npm run test` / `npm run test:watch` | Vitest suite (component + contract + mock fidelity) |
| `npm run ship` | validate → build → copy to `gas/Index.html` → `clasp push` → update the verification deployment (see `docs/ship.md`) |
| `npm run release` | _(final ticket)_ explicit-only production cutover |

Production behavior (`google.script.run`) only exists inside the Apps Script
sandbox — running `dist/index.html` outside it is intentionally unsupported.

## Architecture

One seam between client and server: the **typed API adapter**
(`src/adapter/`, ADR-0002). UI code only sees domain objects (`Dokumen`,
`Sesi`, …) and public `'id'`-stable docId identities; legacy spreadsheet shapes
never leave the adapter. Session expiry is centralized: the adapter raises the
logout hook the app shell subscribes to.

The mock backend (`src/adapter/mock/`) faithfully mirrors `Code.js` contracts,
including role gates and duplicate-sosialisasi collapse; its fidelity is pinned
by tests.

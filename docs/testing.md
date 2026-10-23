# Testing conventions

Established by the harness-bootstrap slice (ticket #2) — the first tests in this
repo. Later slices follow these conventions; change them deliberately, not per
ticket. The rules below are the concrete application of the decisions in spec
#1 ("Testing Decisions").

## Tools

- **Vitest** with **jsdom** (`npx vitest run` / `npm run test:watch`),
  configured in `vite.config.ts` (`test.environment`, `setupFiles`).
- **React Testing Library** with `@testing-library/jest-dom/vitest` matchers
  (registered in `src/test/setup.ts`). `@testing-library/user-event` for
  interactions. No enzyme, no snapshot tests, no test ID libraries.

## File placement and naming

- Tests are **colocated** with the code they pin: `src/<area>/<module>.test.ts[x]`
  (e.g. `src/adapter/normalize.test.ts`, `src/app/app.test.tsx`). Vitest default
  include finds anything `*.test.*`.
- Node tooling under `scripts/` is not app source: it follows the same
  colocated pattern (`scripts/<tool>.test.mjs`), established by the
  ship-pipeline slice (ticket #3).
- Fidelity suites for a sub-package may live alongside it with a `.fidelity.test.ts`
  suffix (`src/adapter/mock/backend.fidelity.test.ts`).
- Shared setup lives in `src/test/setup.ts`. Do not add global mocks there per-test.

## What a test asserts (external behavior only)

1. **Adapter contract tests** (`src/adapter/*.test.ts`) pin what the server seam
   does: legacy raw shapes → typed domain objects, envelope semantics
   (resolve on success / reject `AdapterError` on failure / `sessionExpired`
   hook then reject / connection error on transport failure), token as the
   explicit first argument, and legacy request payloads built by the adapter
   (joined lists, `"-"` placeholders, files omitted on edit).
   Gotcha: pending accounts return the *credentials* error when the password is
   wrong — the status branch only fires for the right password.
2. **Mock fidelity tests** (`src/adapter/mock/backend.fidelity.test.ts`) pin the
   mock backend to the same contracts the real `Code.js` serves: role gates
   (`"Akses ditolak."`), session expiry flags, duplicate-read collapse (first
   record wins), messages verbatim from `Code.js`, seeded states
   (approved/pending/rejected, Admin/User, Baru/Revisi, Aktif/Non-Aktif/Dicabut,
   with/without files). The mock answering differently than the server is a
   production bug waiting anywhere components rely on it.
3. **Component tests** render real components **against the adapter's mock
   backend** through `createApi` — never against a mocked adapter. External
   behavior only: what a user can do and see (roles, buttons, accessible
   names, rendered text). No assertions on internal state, refs, or props.
   App shell convention: components receive their adapter via a factory prop
   (`createAppApi(hooks)`) — tests capture the hooks and drive events
   (e.g. session expiry) through that public seam, wrapped in `act`.

## Helpers and fixtures

- Mock seed data comes from `src/adapter/mock/seed.ts` (fresh per test via
  `createMockBackend()` in `beforeEach`). Demo users and their well-known
  passwords are documented in the seed file — passwords are disposable strings,
  never real credentials.
- Shared Sesi literals for component tests are declared in the component test
  file (see `src/app/app.test.tsx`).

## Gate

`npm run ship` (ticket #3) will run typecheck + lint + the full suite and block
on any failure. Keep `npx vitest run`, `npx tsc -b`, and `npx oxlint` green
before every commit.

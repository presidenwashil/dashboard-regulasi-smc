# Testing conventions

Established by the harness-bootstrap slice (ticket #2) — the first tests in this
repo. Later slices follow these conventions; change them deliberately, not per
ticket. The rules below are the concrete application of the decisions in spec
#1 ("Testing Decisions").

## Tools

- **Vitest** with **jsdom** (`npx vitest run` / `npm run test:watch`),
  configured in `vite.config.ts` (`test.environment`, `test.include`, and
  `setupFiles`).
- **React Testing Library** with **@testing-library/jest-dom/vitest** matchers
  (registered in `tests/react/setup.ts`). `@testing-library/user-event` for
  interactions. No enzyme, no snapshot tests, no test ID libraries.

## File placement and naming

- App and adapter tests are **colocated** with the code they pin:
  `src/<area>/<module>.test.ts[x]` (for example,
  `src/adapter/normalize.test.ts` and `src/pages/FormPage.test.tsx`). Mock
  fidelity tests use `.fidelity.test.ts` alongside the mock backend.
- Shared React utilities and components, plus Apps Script server-module tests,
  live under `tests/react/` and `tests/gas/`, respectively.
- Node tooling tests live alongside their scripts as
  `scripts/<tool>.test.mjs`.
- Vitest explicitly collects all four locations in `vite.config.ts`:
  `tests/react/**/*.test.{ts,tsx}`, `tests/gas/**/*.test.ts`,
  `src/**/*.test.{ts,tsx}`, and `scripts/**/*.test.{mjs,cjs}`. Add new tests
  under one of these patterns; files outside them are not collected by the
  default gate.
- Shared React test setup is `tests/react/setup.ts`. Do not add per-test mocks
  or state there.

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
   App shell convention: `App` accepts a `createAdapter(hooks)` factory prop;
   tests inject an adapter backed by the mock and can capture the hooks to drive
   events (such as session expiry) through that public seam, wrapped in `act`.
4. **Sesi persistence tests** (`src/sesi/sesi.test.ts`) pin storage round-trips,
   malformed-value handling, legacy-key cleanup, and clearing the saved Sesi.

## Helpers and fixtures

- Mock seed data comes from `src/adapter/mock/seed.ts` (fresh per test via
  `createMockBackend()` in `beforeEach`). Demo users and their well-known
  passwords are documented in the seed file — passwords are disposable strings,
  never real credentials.
- Shared Sesi literals for component tests are declared in the component test
  file (see `src/App.test.tsx`).

## Gate

`npm run ship` runs typecheck, lint, the full Vitest suite, and build; it blocks
the ship side effects if any gate fails. The full suite includes the colocated
app tests, `tests/react/`, `tests/gas/`, and `scripts/` suites listed above.
Keep `npx vitest run`, `npx tsc -b`, and `npx oxlint` green before every commit.

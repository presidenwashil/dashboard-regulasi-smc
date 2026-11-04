# Layered architecture for the `gas/` Apps Script backend

The Apps Script backend in `gas/` is organised into four layers plus a leaf,
with a single dependency rule that keeps the call graph acyclic.

## Layers

- `api/` — every no-underscore function (the public functions the React adapter
  calls, plus any other entry point such as `doGet`), as thin delegates. The
  domain logic lives in the matching service.
- `service/` — business rules per domain, one file per domain. A service may
  depend on repositories, `config/`, `lib/`, and `AuthService` — and on no other
  service.
- `repository/` — one repository per sheet (plus a shared base). Sheet access,
  column handling, self-healing, the master write lock, and stable-ID allocation
  live here. Drive file I/O lives in the docs repository.
- `config/` — sheet names, session TTL, and per-sheet column layouts, declared
  once.
- `lib/` — a leaf, not a layer. Stateless helpers (NRP canonicalisation,
  password hashing, HTML escaping, timestamp coercion, Bidang/audience rules).
  Depends on nothing in `gas/`; any layer may use it.

## Dependency rule

`api → service → repository → {config, lib}`. Any service may additionally
depend on `AuthService` and nothing else service-level. Repositories may use
the base, `lib/`, and other repositories. `lib` depends on nothing.

`AuthService` is the single identity/authorization hub and owns `requireAccess_`,
`requireCurrentAdmin_`, and `currentDocumentActor_`, so no other
service-to-service edge is needed and cycles cannot reappear.

## Consequences

- No bundler, ES modules, IIFE, or namespace objects; functions move verbatim
  between files and `*Api.gs` / `*Service.gs` / `*Repo.gs` name files only.
- `appsscript.json` and `Index.html` stay at the `gas/` root; basenames must be
  unique across folders.
- Layer names are not added to `GLOSSARY.md`, which stays for domain terms.
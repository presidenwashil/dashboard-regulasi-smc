# Typed API adapter is the only client–server seam

`google.script.run` only works inside the Apps Script sandbox, so plain React/Vite
dev cannot reach it. We decided: React components talk to the backend **only**
through a small Promise-based typed API adapter. In production it delegates to
`google.script.run`; in development it calls a mock backend seeded with demo data
plus an Admin/User role switcher, enabling fast HMR development without production
data. The adapter stays extensible so a real-server proxy mode can be added later
without changing UI components.

## Considered options

- **Real-server proxy as the primary path** (POST routing via `doPost` in the GAS
  app) — rejected as primary: more moving parts and couples dev to deployed data;
  can still be added behind the adapter later.
- **Calling `google.script.run` directly from components** — rejected: untyped,
  callback-style, and untestable outside the sandbox; the seam exists precisely so
  it doesn't leak.

## Consequences

- UI code never references `google.script.run` directly; session-expiry handling is
  centralized in the adapter.
- The mock must faithfully mirror the server contract established by the Apps
  Script backend in `gas/`
  (`{success, message, data?, sessionExpired?}` responses, normalized NRP, etc.).
- Any API claim must be verified against the real Apps Script environment before a
  feature is released.

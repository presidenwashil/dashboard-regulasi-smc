# Version-pin isolation; separate ship and release commands

A Apps Script web-app deployment always executes the version it was pinned to at
deploy time — `clasp push` updates HEAD, but the production deployment keeps serving
its pinned version until explicitly redeployed. We exploit this instead of building
UI coexistence into `Code.js`: the production deployment (and its URL) stays pinned
to the vanilla version for the whole migration; a separate **verification
deployment** is updated after each `npm run ship` so React builds can be verified on
real Apps Script; `npm run release` alone updates the production deployment to the
latest pushed version, preserving its deployment identity and URL. `Code.js` is not
modified for UI coexistence, and ship never redeploys production.

## Considered options

- **`doGet` route flag / in-app switcher serving vanilla and React from one URL** —
  rejected: requires server-side changes purely for migration plumbing and couples
  the vanilla code path to migration state.
- **`ship` auto-redeploying production** — rejected: every routine push would touch
  all users; release must be a deliberate, explicit step with verification checks.

## Consequences

- Two URLs exist during migration: the stable production URL (vanilla) and the
  verification URL (latest pushed HEAD).
- Cutover = `npm run release`, redeploying the original production deployment; users
  experience it as the same URL switching to the React app.
- A feature may only be released after its real-GAS verification checklist
  (authentication, authorization, session behavior, server integration) passes on
  the verification deployment.

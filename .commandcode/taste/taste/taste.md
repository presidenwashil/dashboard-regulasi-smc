# Taste
- Expects refactors to be behaviour-preserving and incrementally verified: existing test suites must pass with unchanged assertions, and tests are run after each step of a multi-step change. Confidence: 0.6
- Keeps refactors tightly scoped to their stated goal: unrelated cleanups (dead code, hardcoded credentials) are noted as separate follow-ups rather than bundled into the current change. Confidence: 0.55
- Wants to be asked before any change that breaks a frozen contract, such as a public function signature. Confidence: 0.5
- Never deploys to production as part of routine work; requires explicit approval and a stop-and-ask before any production deployment (verification/non-prod deploys are fine). Confidence: 0.7
- For a multi-ticket spec/umbrella issue, prefers an integration branch off `main` that all child-ticket PRs target, with a single final integration→main PR once every child ticket is closed — not child tickets merged straight to `main`. Confidence: 0.7
- Keeps a domain glossary strictly for domain language; architecture/implementation terms do not belong in it. Confidence: 0.5

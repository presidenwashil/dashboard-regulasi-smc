// `npm run release` — the cutover gate (ticket #13, ADR-0003).
//
// The production deployment stays pinned to the vanilla version for the whole
// migration; this script alone redeploys it, preserving its deployment id and
// URL. Sequence: the ship gates (typecheck → lint → tests → build → copy →
// push) run first, then the releaser's explicit interactive confirmation, and
// only then the production redeploy to the freshly pushed version. There is no
// auto-release path.
import { buildGatesAndArtifactSteps, runPipeline } from './ship.mjs'
import { PRODUCTION_DESCRIPTION } from './lib/config.mjs'

export function buildReleaseSteps(rootDir, config) {
  return [
    ...buildGatesAndArtifactSteps(rootDir),
    { name: 'confirm release', confirm: true },
    {
      name: 'redeploy production',
      cmd: ['clasp', 'redeploy', config.productionDeploymentId, '-d', PRODUCTION_DESCRIPTION, '--json'],
      cwd: rootDir,
    },
  ]
}

export { runPipeline }

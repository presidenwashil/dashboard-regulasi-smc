// `npm run release` — the cutover gate (ticket #13, ADR-0003).
//
// The production deployment stays pinned to the vanilla version for the whole
// migration; this script alone redeploys it, preserving its deployment id and
// URL. Sequence: the ship gates (typecheck → lint → tests → build → copy →
// push) run first, then the releaser's explicit interactive confirmation, and
// only then the production redeploy to the freshly pushed version. There is no
// auto-release path.
import { buildGatesAndArtifactSteps, loadConfig, runPipeline } from './ship.mjs'
import { CONFIG_FILE, PRODUCTION_DESCRIPTION, repoRoot } from './lib/config.mjs'
import { runCommand } from './lib/spawn.mjs'
import { copyFileSync, readSync } from 'node:fs'


export function loadReleaseConfig(rootDir) {
  const config = loadConfig(rootDir)
  if (!config?.productionDeploymentId) {
    throw new Error(
      `${CONFIG_FILE} has no productionDeploymentId. Run "npm run release:setup" ` +
        `to identify the production deployment (one-time — see docs/ship.md).`,
    )
  }
  return config
}

// The part of the confirmation that is testable without a real terminal: parse
// one answer, or refuse the whole idea in a non-interactive shell (no prompt can
// actually be answered there, so proceeding at all would bypass the gate).
export function confirmProductionRedeploy(config, { isTTY, io }) {
  if (!isTTY) {
    io.log('✗ Non-interactive shell: refusing to release. The production redeploy')
    io.log('  requires the releaser\'s explicit interactive confirmation — there is no')
    io.log('  auto-release path. Run "npm run release" from a real terminal.')
    return 'refused'
  }
  io.log('About to redeploy the PRODUCTION deployment:')
  io.log(`  deployment ${config.productionDeploymentId} → the latest pushed version`)
  io.log('  Users reach the React app at the SAME URL (id and URL unchanged; ADR-0003).')
  io.log('  This is the cutover: the vanilla app stops being served at this URL.')
  io.log('')
  const answer = (io.readLine() ?? '').trim().toLowerCase()
  if (answer === 'y' || answer === 'yes') return 'accepted'
  return 'aborted'
}

// `clasp redeploy <id> --json` prints a JSON object describing the flip. Read
// the new version out of it so the releaser sees exactly what production now
// serves; anything else means the output is not a redeploy result.
export function parseRedeployResult(raw) {
  const start = raw.indexOf('{')
  if (start !== -1) {
    try {
      const parsed = JSON.parse(raw.slice(start, raw.lastIndexOf('}') + 1))
      if (parsed?.deploymentId && parsed?.versionNumber !== undefined) {
        return { deploymentId: parsed.deploymentId, versionNumber: parsed.versionNumber }
      }
    } catch {
      // fall through to the throw below
    }
  }
  throw new Error(
    'Could not read the new version from the "clasp redeploy --json" output. ' +
      'Check the clasp output above — the redeploy may not have happened.',
  )
}

export function buildReleaseSteps(rootDir, config) {
  return [
    ...buildGatesAndArtifactSteps(rootDir),
    { name: 'confirm release', confirm: true },
    {
      name: 'redeploy production',
      cmd: ['clasp', 'redeploy', config.productionDeploymentId, '-d', PRODUCTION_DESCRIPTION, '--json'],
      cwd: rootDir,
      capture: true,
    },
  ]
}

export { runPipeline }

function main() {
  const rootDir = repoRoot()
  const log = (line) => console.log(line)
  let config
  try {
    config = loadReleaseConfig(rootDir)
  } catch (reason) {
    log(`✗ ${reason.message}`)
    process.exitCode = 1
    return
  }

  let released = null
  const deps = {
    log,
    run: (step) => {
      const res = runCommand(step.cmd[0], step.cmd.slice(1), {
        cwd: step.cwd ?? rootDir,
        stdio: step.capture ? 'pipe' : 'inherit',
      })
      if (step.capture) {
        if (res.stderr?.length) log(res.stderr.toString().trim())
        if (res.stdout?.length) log(res.stdout.toString().trim())
        if (res.status === 0) {
          try {
            released = parseRedeployResult(res.stdout?.toString('utf8') ?? '')
          } catch (reason) {
            log(`⚠ ${reason.message}`)
          }
        }
      }
      return res.status === 0
    },
    copy: (step) => {
      try {
        copyFileSync(step.copy.src, step.copy.dst)
        log(`  ${step.copy.dst} ← ${step.copy.src}`)
        return true
      } catch (reason) {
        log(`  copy failed: ${reason.message}`)
        return false
      }
    },
    confirm: (step) => {
      const result = confirmProductionRedeploy(config, {
        isTTY: Boolean(process.stdin?.isTTY),
        io: { log, readLine: readStdinLine },
      })
      if (result === 'accepted') return true
      if (result === 'aborted') {
        log('✘ Aborted — production is untouched; nothing was redeployed.')
      }
      process.exitCode = 1
      return false
    },
  }

  const ok = runPipeline(buildReleaseSteps(rootDir, config), deps)
  if (!ok) {
    process.exitCode = 1
    return
  }
  if (released) {
    log(
      `✔ Released: production deployment ${released.deploymentId} redeployed to version ` +
        `@${released.versionNumber} — the URL is unchanged; the cutover is complete.`,
    )
  } else {
    log('✔ Released: production deployment redeployed — the URL is unchanged; the cutover is complete.')
  }
  log(`  Open the released app: clasp open-web-app ${config.productionDeploymentId} (from the repo root)`)
}

// Synchronous one-line read from stdin: the confirmation gate must block until
// the human answers, and the pipeline runner is synchronous. readSync on an
// interactive (line-mode) stdin returns once the user commits a line.
function readStdinLine() {
  const buf = Buffer.alloc(256)
  let bytes
  try {
    bytes = readSync(0, buf, 0, 256)
  } catch {
    return ''
  }
  if (!bytes || bytes <= 0) return ''
  return buf.toString('utf8', 0, bytes).replace(/\r?\n$/, '')
}

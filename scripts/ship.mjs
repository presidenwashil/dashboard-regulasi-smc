// `npm run ship` — the ship pipeline (ticket #3, ADR-0003).
//
// Gates: typecheck → lint → full test suite → build. Only if every gate
// passes: build the single-file artifact, copy it over the Apps Script repo's
// Index.html, `clasp push`, and redeploy ONLY the verification deployment.
// Production is never touched by ship (its deployment is pinned to the
// vanilla version for the whole migration — see docs/adr/0003).
//
// The verification deployment id lives in ship.config.json at the repo root,
// written by the one-time setup (`npm run ship:setup`, documented in
// docs/ship.md). Auth stays on the developer machine (ADR-0001).
import { copyFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runCommand } from './lib/spawn.mjs'

const CONFIG_FILE = 'ship.config.json'

export function loadConfig(rootDir) {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(path.join(rootDir, CONFIG_FILE), 'utf8'))
  } catch {
    throw new Error(
      `No usable ${CONFIG_FILE} at ${rootDir}. Run the one-time setup ` +
        `("npm run ship:setup" — see docs/ship.md) and commit the verification deployment id.`,
    )
  }
  if (!parsed.verificationDeploymentId) {
    throw new Error(
      `${CONFIG_FILE} has no verificationDeploymentId. Run "npm run ship:setup" ` +
        `(one-time setup — see docs/ship.md).`,
    )
  }
  return parsed
}

export function buildSteps(rootDir, config) {
  const siblingRepo = path.resolve(rootDir, '..', 'bank-dokumen')
  const description = 'verification: React replatform client (npm run ship)'
  return [
    { name: 'typecheck', cmd: ['npm', 'run', 'typecheck'] },
    { name: 'lint', cmd: ['npm', 'run', 'lint'] },
    { name: 'tests', cmd: ['npm', 'run', 'test'] },
    { name: 'build', cmd: ['npm', 'run', 'build'] },
    {
      name: 'copy artifact',
      copy: {
        src: path.join(rootDir, 'dist', 'index.html'),
        dst: path.join(siblingRepo, 'Index.html'),
      },
    },
    { name: 'clasp push', cmd: ['clasp', 'push'], cwd: siblingRepo },
    {
      name: 'redeploy verification',
      cmd: ['clasp', 'redeploy', config.verificationDeploymentId, '-d', description],
      cwd: siblingRepo,
    },
  ]
}

export function runPipeline(steps, deps) {
  const { run, copy, log } = deps
  for (const step of steps) {
    log(`▶ ${step.name}`)
    let ok
    if (step.copy) {
      ok = copy(step)
    } else {
      ok = run(step)
    }
    if (!ok) {
      log(`✗ ${step.name} failed — stopping. No later step ran; nothing was deployed.`)
      return false
    }
  }
  log('✔ Shipped: gates green, artifact built and pushed, verification deployment redeployed.')
  return true
}

function main() {
  const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
  const log = (line) => console.log(line)
  const config = loadConfig(rootDir)
  const deps = {
    log,
    run: (step) =>
      runCommand(step.cmd[0], step.cmd.slice(1), {
        cwd: step.cwd ?? rootDir,
        stdio: 'inherit',
      }).status === 0,
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
  }
  const ok = runPipeline(buildSteps(rootDir, config), deps)
  if (!ok) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}

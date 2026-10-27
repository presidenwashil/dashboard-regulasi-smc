// One-time setup for the ship pipeline (ticket #3, docs/ship.md).
//
// 1. Confirms clasp is authenticated (human-only prerequisite — `clasp login`
//    cannot be automated; see docs/ship.md if this fails).
// 2. Creates the **verification deployment** for this repo's Apps Script
//    project (a NEW deployment; the production deployment and every other
//    existing deployment are left untouched).
// 3. Writes the deployment id into this repo's ship.config.json and opens
//    the verification web app for a first look.
//
// Run once from the repo root: `npm run ship:setup` — idempotent (an existing
// ship.config.json is kept).
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { runCommand } from './lib/spawn.mjs'
import { CONFIG_FILE, repoRoot, VERIFICATION_DESCRIPTION } from './lib/config.mjs'

export function deploymentIdFromDeployOutput(output) {
  const match = output.match(/AKfycb[\w-]+/)
  return match?.[0] ?? null
}

export function configPath(rootDir) {
  return path.join(rootDir, CONFIG_FILE)
}

function main() {
  const rootDir = repoRoot()
  const log = (line) => console.log(line)
  const stop = (lines) => {
    for (const line of lines) log(line)
    process.exitCode = 1
  }

  if (!existsSync(path.join(rootDir, '.clasp.json'))) {
    throw new Error('No .clasp.json at the repo root — clasp cannot find the Apps Script project.')
  }

  const who = runCommand('clasp', ['show-authorized-user'], {
    cwd: rootDir,
    encoding: 'utf8',
  })
  if (who.status !== 0) {
    stop([
      '✗ clasp is not authenticated. clasp login is a human-only step:',
      '  open a terminal in the Apps Script repo and run `clasp login` (browser flow),',
      '  then re-run `npm run ship:setup`. Details: docs/ship.md',
    ])
    return
  }
  log(who.stdout.trim())

  if (existsSync(configPath(rootDir))) {
    log(`${CONFIG_FILE} already exists — keeping it. Nothing to do.`)
    return
  }

  log('Creating the verification deployment (a NEW deployment; production is untouched)...')
  const deploy = runCommand('clasp', ['deploy', '-d', VERIFICATION_DESCRIPTION], {
    cwd: rootDir,
    encoding: 'utf8',
  })
  const output = `${deploy.stdout ?? ''}${deploy.stderr ?? ''}`
  if (deploy.status !== 0) {
    stop([
      `✗ clasp deploy failed — see docs/ship.md for the human-only prerequisites`,
      `  (clasp login, Apps Script API enabled):`,
      output,
    ])
    return
  }
  const deploymentId = deploymentIdFromDeployOutput(output)
  if (!deploymentId) {
    stop([`✗ Could not read a deployment id from clasp output:`, output])
    return
  }

  writeFileSync(
    configPath(rootDir),
    JSON.stringify({ verificationDeploymentId: deploymentId }, null, 2) + '\n',
  )
  log(`✔ Verification deployment ${deploymentId} created and saved to ${CONFIG_FILE}.`)
  log('Commit ship.config.json, then ship with `npm run ship`.')
  log(openVerificationApp(deploymentId, rootDir))
}

function openVerificationApp(deploymentId, rootDir) {
  const open = runCommand('clasp', ['open-web-app', deploymentId], {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: 'ignore',
  })
  return open.status === 0
    ? 'The verification web app URL was opened in your browser.'
    : `Open the verification app with: clasp open-web-app ${deploymentId} (run from the repo root)`
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}

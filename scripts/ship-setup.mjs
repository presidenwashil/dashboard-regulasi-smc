// One-time setup for the ship pipeline (ticket #3, docs/ship.md).
//
// 1. Confirms clasp is authenticated (human-only prerequisite — `clasp login`
//    cannot be automated; see docs/ship.md if this fails).
// 2. Creates the **verification deployment** for the sibling Apps Script
//    project (a NEW deployment; the production deployment and every other
//    existing deployment are left untouched).
// 3. Writes the deployment id into this repo's ship.config.json.
//
// Run once from the repo root: `npm run ship:setup`
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runCommand } from './lib/spawn.mjs'

const CONFIG_FILE = 'ship.config.json'
const SIBLING_REPO = 'bank-dokumen'

export function deploymentIdFromDeployOutput(output) {
  const match = output.match(/AKfycb[\w-]+/)
  return match?.[0] ?? null
}

export function configPath(rootDir) {
  return path.join(rootDir, CONFIG_FILE)
}

function main() {
  const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
  const siblingRepo = path.resolve(rootDir, '..', SIBLING_REPO)
  const log = (line) => console.log(line)

  if (!existsSync(path.join(siblingRepo, '.clasp.json'))) {
    throw new Error(`No .clasp.json in ${siblingRepo} — is the sibling Apps Script repo checked out?`)
  }

  const who = runCommand('clasp', ['show-authorized-user'], {
    cwd: siblingRepo,
    encoding: 'utf8',
  })
  if (who.status !== 0) {
    log('✗ clasp is not authenticated. clasp login is a human-only step:')
    log('  open a terminal in the Apps Script repo and run `clasp login` (browser flow),')
    log('  then re-run `npm run ship:setup`. Details: docs/ship.md')
    process.exitCode = 1
    return
  }
  log(who.stdout.trim())

  if (existsSync(configPath(rootDir))) {
    log(`${CONFIG_FILE} already exists — keeping it. Nothing to do.`)
    return
  }

  log('Creating the verification deployment (a NEW deployment; production is untouched)...')
  const deploy = runCommand(
    'clasp',
    ['deploy', '-d', 'verification: React replatform client'],
    { cwd: siblingRepo, encoding: 'utf8' },
  )
  const output = `${deploy.stdout ?? ''}${deploy.stderr ?? ''}`
  if (deploy.status !== 0) {
    log(`✗ clasp deploy failed:\n${output}`)
    process.exitCode = 1
    return
  }
  const deploymentId = deploymentIdFromDeployOutput(output)
  if (!deploymentId) {
    log(`✗ Could not read a deployment id from clasp output:\n${output}`)
    process.exitCode = 1
    return
  }

  writeFileSync(
    configPath(rootDir),
    JSON.stringify({ verificationDeploymentId: deploymentId }, null, 2) + '\n',
  )
  log(`✔ Verification deployment ${deploymentId} created and saved to ${CONFIG_FILE}.`)
  log('Commit ship.config.json, then ship with `npm run ship`.')
  log(urlHint(deploymentId, siblingRepo))
}

function urlHint(deploymentId, siblingRepo) {
  const open = runCommand('clasp', ['open-web-app', deploymentId], {
    cwd: siblingRepo,
    encoding: 'utf8',
    stdio: 'ignore',
  })
  return open.status === 0
    ? 'The verification web app URL was opened in your browser.'
    : `Open the verification app with: clasp open-web-app ${deploymentId} (run in ../${SIBLING_REPO})`
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}

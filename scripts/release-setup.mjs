// `npm run release:setup` — one-time identification of the production
// deployment (ticket #13, ADR-0003).
//
// `release` must redeploy the *existing* production deployment, preserving id
// and URL; nothing in the repo knows which one it is (the deployment list only
// shows ids/versions/descriptions, and production is the one pinned to the
// vanilla version). A human makes that call here — interactively, from a real
// terminal — and the chosen id is written to ship.config.json next to the
// verification id. Re-running setup is safe: it just overwrites the choice.
import { readSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { runCommand } from './lib/spawn.mjs'
import { CONFIG_FILE, repoRoot } from './lib/config.mjs'
import { loadConfig } from './ship.mjs'

// Lines look like `- <id> @<version> [- <description>]`, e.g.:
//   - AKfycbw…Cw @15 - verification: React replatform client
//   - AKfycbw…jJ @HEAD
export function parseDeployments(output) {
  const deployments = []
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^- (AKfycb[\w-]+) @([^ ]+)(?: - (.*?))?\s*$/)
    if (match) {
      deployments.push({ id: match[1], version: match[2], description: match[3] ?? '' })
    }
  }
  if (deployments.length === 0) {
    throw new Error(
      'No deployment lines in the clasp deployments output — check the raw output above ' +
        '(auth or Apps Script API problems print there).',
    )
  }
  return deployments
}

export function chooseProductionDeployment(deployments, id, verificationId) {
  if (!id) {
    throw new Error(`No deployment id given — type one of the listed deployment ids.`)
  }
  if (id === verificationId) {
    throw new Error(
      'That is the verification deployment (ship.config.json) — it rides ship, not release. ' +
        'Choose the production deployment instead.',
    )
  }
  if (!deployments.some((d) => d.id === id)) {
    throw new Error(`That id is not listed above — pick one of the deployments shown by "clasp deployments".`)
  }
  return id
}

export function mergeConfig(existing, productionDeploymentId) {
  return (
    JSON.stringify(
      { ...existing, productionDeploymentId },
      null,
      2,
    ) + '\n'
  )
}

function main() {
  const rootDir = repoRoot()
  const log = (line) => console.log(line)
  const stop = (lines) => {
    for (const line of lines) log(line)
    process.exitCode = 1
  }

  // release:setup runs before the production id exists, so unlike `release`
  // it needs the verification id only (it is the one adding the prod id).
  let existing
  try {
    existing = loadConfig(rootDir)
  } catch (reason) {
    stop([
      `✗ ${reason.message}`,
      `  Identification of the production deployment needs the verification id in place first.`,
    ])
    return
  }

  if (!process.stdin?.isTTY) {
    stop([
      '✗ Non-interactive shell: refusing to run release:setup. Choosing the production',
      '  deployment is a human call (one-way-door identity decision). Run',
      '  "npm run release:setup" in a real terminal and answer the prompt.',
    ])
    return
  }

  log('Listing the Apps Script deployments (read-only)...')
  const listed = runCommand('clasp', ['deployments'], { cwd: rootDir })
  const output = `${listed.stdout ?? ''}${listed.stderr ?? ''}`
  if (listed.status !== 0) {
    stop([
      `✗ clasp deployments failed — see docs/ship.md for human-only prerequisites`,
      `  (clasp login, Apps Script API enabled):`,
      output,
    ])
    return
  }
  let deployments
  try {
    deployments = parseDeployments(output)
  } catch (reason) {
    stop([`✗ ${reason.message}`])
    return
  }

  log('')
  log('The Apps Script project has these deployments:')
  for (const d of deployments) {
    const tag = d.id === existing.verificationDeploymentId ? '  ← verification (ship; never release)' : ''
    log(`  ${d.id}  @${d.version}${d.description ? ` - ${d.description}` : ''}${tag}`)
  }
  log('')
  log('Which one is PRODUCTION (the deployment the live app URL serves, pinned to the')
  log('vanilla version — see ADR-0003 and docs/ship.md)? Paste its deployment id:')
  process.stdout.write('> ')

  let chosen
  try {
    chosen = chooseProductionDeployment(deployments, readStdinLine(), existing.verificationDeploymentId)
  } catch (reason) {
    stop([`✗ ${reason.message}`, `  Nothing was written. Re-run "npm run release:setup".`])
    return
  }

  const file = path.join(rootDir, CONFIG_FILE)
  const text = mergeConfig(existing, chosen)
  writeFileSync(file, text)
  log('')
  log(`✔ Production deployment ${chosen} saved to ${CONFIG_FILE}:`)
  log(text.trimEnd())
  log('Commit ship.config.json. From now on `npm run release` redeploys exactly this deployment.')
}

// Same synchronous line read as release.mjs: the prompt must block on a human.
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}

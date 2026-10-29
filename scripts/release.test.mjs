// Release pipeline tests — ticket #13 (cutover gate, ADR-0003). Colocated like
// ship.test.mjs: these pin the pipeline's external behavior (step order, the
// confirmation gate, prod-only redeploy) through injected dependencies, never
// by spawning anything real. Production is only touched after the interactive
// confirmation step — the human-in-the-loop is the gate.
import { describe, expect, it } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { buildReleaseSteps, confirmProductionRedeploy, loadReleaseConfig, parseRedeployResult, runPipeline } from './release.mjs'
import { PRODUCTION_DESCRIPTION } from './lib/config.mjs'

const ROOT = process.cwd()

describe('confirmProductionRedeploy', () => {
  const config = { productionDeploymentId: 'AKfycb_P' }

  function fakeIo(answer) {
    const log = []
    return { log: (line) => log.push(line), lines: log, readLine: () => answer }
  }

  it('refuses to even prompt when the shell is non-interactive', () => {
    const io = fakeIo('')
    const result = confirmProductionRedeploy(config, { isTTY: false, io })

    expect(result).toBe('refused')
    expect(io.lines.join('\n')).toMatch(/non-interactive/i)
  })

  it('accepts an explicit y/yes after printing what is about to happen', () => {
    const io = fakeIo('y')
    const result = confirmProductionRedeploy(config, { isTTY: true, io })

    expect(result).toBe('accepted')
    expect(io.lines.join('\n')).toMatch(/AKfycb_P/)
    expect(io.lines.join('\n')).toMatch(/same URL/i)
  })

  it('accepts YES in any casing with surrounding whitespace', () => {
    expect(confirmProductionRedeploy(config, { isTTY: true, io: fakeIo('  Yes ') })).toBe('accepted')
  })

  it('aborts without touching production on any other answer', () => {
    for (const answer of ['n', 'no', '', 'ok', 'ye']) {
      expect(
        confirmProductionRedeploy(config, { isTTY: true, io: fakeIo(answer) }),
      ).not.toBe('accepted')
    }
  })
})

describe('parseRedeployResult', () => {
  it('reads the deployment id and new version from clasp redeploy --json', () => {
    const raw =
      'Deploying project...\n' +
      '{\n  "deploymentId": "AKfycb_P",\n  "versionNumber": 16,\n  "description": "production: React replatform client"\n}\n'

    expect(parseRedeployResult(raw)).toEqual({
      deploymentId: 'AKfycb_P',
      versionNumber: 16,
    })
  })

  it('throws when clasp output carries no parseable JSON', () => {
    expect(() => parseRedeployResult('clasp: API error: something failed')).toThrow(/redeploy|--json|version/i)
  })
})

describe('loadReleaseConfig', () => {
  it('reads both deployment ids from the shared repo config', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'release-config-'))
    writeFileSync(
      path.join(tmp, 'ship.config.json'),
      JSON.stringify({
        verificationDeploymentId: 'AKfycb_V',
        productionDeploymentId: 'AKfycb_P',
      }),
    )

    expect(loadReleaseConfig(tmp)).toEqual({
      verificationDeploymentId: 'AKfycb_V',
      productionDeploymentId: 'AKfycb_P',
    })
  })

  it('fails fast, pointing at release:setup, when the production id is missing', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'release-config-'))
    writeFileSync(
      path.join(tmp, 'ship.config.json'),
      JSON.stringify({ verificationDeploymentId: 'AKfycb_V' }),
    )

    expect(() => loadReleaseConfig(tmp)).toThrow(/release:setup/)
  })

  it('passes through loadConfig\'s own failures (missing file, broken JSON)', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'release-config-'))
    expect(() => loadReleaseConfig(tmp)).toThrow(/ship:setup/)

    writeFileSync(path.join(tmp, 'ship.config.json'), '{ oops')
    expect(() => loadReleaseConfig(tmp)).toThrow(/JSON/)
  })
})

function fakeReleaseDeps({ accepted = true } = {}) {
  const log = []
  const executed = []
  const deps = {
    log: (line) => log.push(line),
    run: (step) => {
      executed.push(step.name)
      return true
    },
    copy: (step) => {
      executed.push(step.name)
      return true
    },
    confirm: (step) => {
      executed.push(step.name)
      return accepted
    },
  }
  return { deps, log, executed }
}

describe('runPipeline: the confirmation gate', () => {
  it('redeploys production only after the confirmation step runs and is accepted', () => {
    const { deps, executed, log } = fakeReleaseDeps()
    const steps = buildReleaseSteps(ROOT, {
      verificationDeploymentId: 'AKfycb_V',
      productionDeploymentId: 'AKfycb_P',
    })

    const ok = runPipeline(steps, deps)

    expect(ok).toBe(true)
    expect(executed).toEqual([
      'typecheck',
      'lint',
      'tests',
      'build',
      'copy artifact',
      'clasp push',
      'confirm release',
      'redeploy production',
    ])
    // The runner's wording belongs to its caller: the release prints its own result.
    expect(log.join('\n')).not.toMatch(/Shipped/)
  })

  it('stops at the declined confirmation: everything after it never runs', () => {
    const { deps, executed } = fakeReleaseDeps({ accepted: false })
    const steps = buildReleaseSteps(ROOT, {
      verificationDeploymentId: 'AKfycb_V',
      productionDeploymentId: 'AKfycb_P',
    })

    const ok = runPipeline(steps, deps)

    expect(ok).toBe(false)
    expect(executed).toEqual([
      'typecheck',
      'lint',
      'tests',
      'build',
      'copy artifact',
      'clasp push',
      'confirm release',
    ])
  })
})

describe('buildReleaseSteps', () => {
  it('runs the ship gates through clasp push, then confirmation, then the production redeploy', () => {
    const steps = buildReleaseSteps(ROOT, {
      verificationDeploymentId: 'AKfycb_V',
      productionDeploymentId: 'AKfycb_P',
    })

    expect(steps.map((s) => s.name)).toEqual([
      'typecheck',
      'lint',
      'tests',
      'build',
      'copy artifact',
      'clasp push',
      'confirm release',
      'redeploy production',
    ])
  })

  it('redeploys only the production deployment, as JSON, from the repo root', () => {
    const steps = buildReleaseSteps(ROOT, {
      verificationDeploymentId: 'AKfycb_V',
      productionDeploymentId: 'AKfycb_P',
    })

    const redeploy = steps.find((s) => s.name === 'redeploy production')
    expect(redeploy.cmd).toEqual([
      'clasp',
      'redeploy',
      'AKfycb_P',
      '-d',
      PRODUCTION_DESCRIPTION,
      '--json',
    ])
    expect(redeploy.cwd).toBe(ROOT)
    // main() captures this step's output to print the new version — the
    // builder/main contract for the version print.
    expect(redeploy.capture).toBe(true)
  })

  it('never references the verification deployment (release must not touch it)', () => {
    const steps = buildReleaseSteps(ROOT, {
      verificationDeploymentId: 'AKfycb_V',
      productionDeploymentId: 'AKfycb_P',
    })

    expect(JSON.stringify(steps)).not.toContain('AKfycb_V')
    expect(JSON.stringify(steps)).toContain('AKfycb_P')
  })
})

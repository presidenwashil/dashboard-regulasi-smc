// Release pipeline tests — ticket #13 (cutover gate, ADR-0003). Colocated like
// ship.test.mjs: these pin the pipeline's external behavior (step order, the
// confirmation gate, prod-only redeploy) through injected dependencies, never
// by spawning anything real. Production is only touched after the interactive
// confirmation step — the human-in-the-loop is the gate.
import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { buildReleaseSteps, runPipeline } from './release.mjs'
import { PRODUCTION_DESCRIPTION } from './lib/config.mjs'

const ROOT = process.cwd()

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

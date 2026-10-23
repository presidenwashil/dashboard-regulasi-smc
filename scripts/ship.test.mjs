// Ship pipeline tests — ticket #3. Colocated per docs/testing.md, but scripts/
// is node tooling, not app source: these pin the pipeline's external behavior
// (gate order, halt-on-failure, clasp usage) through injected dependencies,
// never by spawning anything real.
import { describe, expect, it } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { buildSteps, loadConfig, runPipeline } from './ship.mjs'

const ROOT = process.cwd()
const SIBLING = path.resolve(ROOT, '..', 'bank-dokumen')

function fakeDeps({ failStep, failCopy } = {}) {
  const log = []
  const executed = []
  const deps = {
    log: (line) => log.push(line),
    run: (step) => {
      executed.push(step.name)
      return step.name !== failStep
    },
    copy: (step) => {
      executed.push(step.name)
      return !(step.name === failCopy)
    },
  }
  return { deps, log, executed }
}

describe('runPipeline', () => {
  it('runs the full pipeline gate-first on success', () => {
    const { deps, executed } = fakeDeps()
    const steps = buildSteps(ROOT, { verificationDeploymentId: 'AKfycb_V' })

    const ok = runPipeline(steps, deps)

    expect(ok).toBe(true)
    expect(executed).toEqual([
      'typecheck',
      'lint',
      'tests',
      'build',
      'copy artifact',
      'clasp push',
      'redeploy verification',
    ])
  })

  it('halts at the first failing validation gate and runs no later step', () => {
    const { deps, executed } = fakeDeps({ failStep: 'lint' })
    const steps = buildSteps(ROOT, { verificationDeploymentId: 'AKfycb_V' })

    const ok = runPipeline(steps, deps)

    expect(ok).toBe(false)
    expect(executed).toEqual(['typecheck', 'lint'])
    // Side effects (build/copy/clasp/redeploy) never happen after a failed gate.
  })

  it('stops before any clasp step when the copy fails', () => {
    const { deps, executed } = fakeDeps({ failCopy: 'copy artifact' })
    const steps = buildSteps(ROOT, { verificationDeploymentId: 'AKfycb_V' })

    const ok = runPipeline(steps, deps)

    expect(ok).toBe(false)
    expect(executed).toEqual(['typecheck', 'lint', 'tests', 'build', 'copy artifact'])
  })

  it('reports the failing step with a clear banner', () => {
    const { deps, log } = fakeDeps({ failStep: 'tests' })
    const steps = buildSteps(ROOT, { verificationDeploymentId: 'AKfycb_V' })

    runPipeline(steps, deps)

    expect(log.join('\n')).toMatch(/✗ tests failed/)
  })
})

describe('buildSteps', () => {
  it('copies the built single file into the Apps Script repo', () => {
    const steps = buildSteps(ROOT, { verificationDeploymentId: 'AKfycb_V' })
    const copy = steps.find((s) => s.name === 'copy artifact')

    expect(copy.copy.src).toBe(path.join(ROOT, 'dist', 'index.html'))
    expect(copy.copy.dst).toBe(path.join(SIBLING, 'Index.html'))
  })

  it('pushes with clasp from the Apps Script repo directory', () => {
    const steps = buildSteps(ROOT, { verificationDeploymentId: 'AKfycb_V' })
    const push = steps.find((s) => s.name === 'clasp push')

    expect(push.cmd).toEqual(['clasp', 'push'])
    expect(push.cwd).toBe(SIBLING)
  })

  it('redeploys only the configured verification deployment', () => {
    const steps = buildSteps(ROOT, { verificationDeploymentId: 'AKfycb_V' })
    const redeploy = steps.find((s) => s.name === 'redeploy verification')

    expect(redeploy.cmd).toContain('AKfycb_V')
    expect(redeploy.cwd).toBe(SIBLING)
  })
})

describe('loadConfig', () => {
  it('fails fast, pointing at the one-time setup, when not configured', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'ship-config-'))
    expect(() => loadConfig(tmp)).toThrow(/ship:setup/)
  })

  it('reads the verification deployment id from repo config', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'ship-config-'))
    writeFileSync(
      path.join(tmp, 'ship.config.json'),
      JSON.stringify({ verificationDeploymentId: 'AKfycb_X' }),
    )

    expect(loadConfig(tmp)).toEqual({ verificationDeploymentId: 'AKfycb_X' })
  })
})

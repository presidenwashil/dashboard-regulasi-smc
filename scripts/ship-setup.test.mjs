// Pins for the one-time ship setup helpers (see docs/testing.md conventions).
import { describe, expect, it } from 'vitest'
import { deploymentIdFromDeployOutput } from './ship-setup.mjs'

describe('deploymentIdFromDeployOutput', () => {
  it('extracts the new deployment id from clasp deploy output', () => {
    const output = '- AKfycbzAnVl45EVx6FA-jfJ9aQqW2o8Dgy1QOjx8vOlyejjSLQR5PXfPPih3Ggw @7.\n'
    expect(deploymentIdFromDeployOutput(output)).toBe(
      'AKfycbzAnVl45EVx6FA-jfJ9aQqW2o8Dgy1QOjx8vOlyejjSLQR5PXfPPih3Ggw',
    )
  })

  it('returns null when clasp output has no deployment id', () => {
    expect(deploymentIdFromDeployOutput('deploy failed for unrelated reasons')).toBeNull()
  })
})

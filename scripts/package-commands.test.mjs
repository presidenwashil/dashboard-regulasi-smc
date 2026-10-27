import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const rootUrl = pathToFileURL(`${process.cwd()}/`)
const pkg = JSON.parse(readFileSync(new URL('./package.json', rootUrl), 'utf8'))

describe('package scripts', () => {
  it('exposes the ship pipeline commands', () => {
    expect(pkg.scripts).toHaveProperty('ship', 'node scripts/ship.mjs')
    expect(pkg.scripts).toHaveProperty('ship:setup', 'node scripts/ship-setup.mjs')
  })
})

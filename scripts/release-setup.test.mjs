// release:setup tests — ticket #13. Same discipline as ship.test.mjs: the
// interactive parts run through injected state; the clasp output parser is
// pinned to the real output format observed on this machine (worked example).
import { describe, expect, it } from 'vitest'
import { chooseProductionDeployment, mergeConfig, parseDeployments } from './release-setup.mjs'
import { CONFIG_FILE } from './lib/config.mjs'

// Literal clasp deployments output (same format every machine: id @version [- description]).
const CLASP_OUTPUT = [
  'Found 7 deployments.',
  '- AKfycbw8Hh7Am8skUoXrCGpnJdwTsZL1ynGMNW_JD_5yq5jJ @HEAD ',
  '- AKfycbxZyoVaJpWLQQ55zNQg-DqtPn8u6tFoT1jcylcSl0q2t7mZwIAHP0Ms2cJebw8hiHNoYA @13 - T3 adapter screen migration smoke test',
  '- AKfycbwVZIE6cvottokDp8qA872PCk-6V5qXkSlXY6t3cqgxOCAGeWxfPWTNmXLY6DYroR_hxA @1 ',
  '- AKfycbzbpPx_SrAOuTeT61cdJ3uJikRqM509zoNkx-mflreO7Eu2KhLyH6sXuS1-RtjBZOUQjA @14 - feat: account self-service and user progress reporting',
  '- AKfycbzAnVl45EVx6FA-jfJ9aQqW2o8Dgy1QOjx8vOlyejjSLQR5PXfPPih3GgwGBx6ZFwbBIQ @3 ',
  '- AKfycbypA6IvZjWlrBWWu6zT7mH-_fUAMupa71i8fUs7Oyd0DUj1AMg0jJw6jM0mbKoOU7veVg @2 ',
  '- AKfycbw5XnEOk7vz1kFlJdvSDwc6L5Q1FkKF6Czdk88jru1VKXT7C2g8kBDD_pVV_3JB0LXtCw @15 - verification: React replatform client',
  '',
].join('\n')

describe('parseDeployments', () => {
  it('reads id, version, and description from real clasp deployments output', () => {
    expect(parseDeployments(CLASP_OUTPUT)).toEqual([
      { id: 'AKfycbw8Hh7Am8skUoXrCGpnJdwTsZL1ynGMNW_JD_5yq5jJ', version: 'HEAD', description: '' },
      {
        id: 'AKfycbxZyoVaJpWLQQ55zNQg-DqtPn8u6tFoT1jcylcSl0q2t7mZwIAHP0Ms2cJebw8hiHNoYA',
        version: '13',
        description: 'T3 adapter screen migration smoke test',
      },
      { id: 'AKfycbwVZIE6cvottokDp8qA872PCk-6V5qXkSlXY6t3cqgxOCAGeWxfPWTNmXLY6DYroR_hxA', version: '1', description: '' },
      {
        id: 'AKfycbzbpPx_SrAOuTeT61cdJ3uJikRqM509zoNkx-mflreO7Eu2KhLyH6sXuS1-RtjBZOUQjA',
        version: '14',
        description: 'feat: account self-service and user progress reporting',
      },
      { id: 'AKfycbzAnVl45EVx6FA-jfJ9aQqW2o8Dgy1QOjx8vOlyejjSLQR5PXfPPih3GgwGBx6ZFwbBIQ', version: '3', description: '' },
      { id: 'AKfycbypA6IvZjWlrBWWu6zT7mH-_fUAMupa71i8fUs7Oyd0DUj1AMg0jJw6jM0mbKoOU7veVg', version: '2', description: '' },
      {
        id: 'AKfycbw5XnEOk7vz1kFlJdvSDwc6L5Q1FkKF6Czdk88jru1VKXT7C2g8kBDD_pVV_3JB0LXtCw',
        version: '15',
        description: 'verification: React replatform client',
      },
    ])
  })

  it('throws on output with no deployment lines (auth/API failures surface the raw text)', () => {
    expect(() => parseDeployments('clasp: not authenticated. Run clasp login.')).toThrow(/deployments/i)
  })
})

describe('chooseProductionDeployment', () => {
  const deployments = parseDeployments(CLASP_OUTPUT)
  const VERIFICATION = 'AKfycbw5XnEOk7vz1kFlJdvSDwc6L5Q1FkKF6Czdk88jru1VKXT7C2g8kBDD_pVV_3JB0LXtCw'

  it('accepts one of the listed deployment ids', () => {
    expect(
      chooseProductionDeployment(deployments, 'AKfycbwVZIE6cvottokDp8qA872PCk-6V5qXkSlXY6t3cqgxOCAGeWxfPWTNmXLY6DYroR_hxA', VERIFICATION),
    ).toBe('AKfycbwVZIE6cvottokDp8qA872PCk-6V5qXkSlXY6t3cqgxOCAGeWxfPWTNmXLY6DYroR_hxA')
  })

  it('rejects an id that clasp did not list (typo protection)', () => {
    expect(() => chooseProductionDeployment(deployments, 'AKfycb_typo', VERIFICATION)).toThrow(/not listed/i)
  })

  it('rejects choosing the verification deployment as production', () => {
    expect(() => chooseProductionDeployment(deployments, VERIFICATION, VERIFICATION)).toThrow(/verification/i)
  })

  it('rejects an empty answer', () => {
    expect(() => chooseProductionDeployment(deployments, '', VERIFICATION)).toThrow(/no deployment id/i)
  })
})

describe('mergeConfig', () => {
  it('keeps the verification id and adds the production id, ready to commit', () => {
    expect(
      mergeConfig({ verificationDeploymentId: 'AKfycb_V' }, 'AKfycb_P'),
    ).toBe(
      `${JSON.stringify({ verificationDeploymentId: 'AKfycb_V', productionDeploymentId: 'AKfycb_P' }, null, 2)}\n`,
    )
  })

  it('overwrites a previously set production id (re-running setup is safe)', () => {
    expect(
      JSON.parse(
        mergeConfig(
          { verificationDeploymentId: 'AKfycb_V', productionDeploymentId: 'AKfycb_OLD' },
          'AKfycb_P',
        ),
      ),
    ).toEqual({ verificationDeploymentId: 'AKfycb_V', productionDeploymentId: 'AKfycb_P' })
  })

  it('writes into the shared ship.config.json file (one pins file)', () => {
    expect(CONFIG_FILE).toBe('ship.config.json')
  })
})

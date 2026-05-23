import { describe, expect, it } from 'vitest'
import { extractEnterpriseAuthCallbackUrl, isEnterpriseAuthCallbackUrl } from '../../../electron/authCallback'
import { parseEnterpriseAuthCallback } from '../../../src/enterprise/session'

describe('enterprise deeplink parsing', () => {
  it('accepts muon auth callback codes', () => {
    expect(parseEnterpriseAuthCallback('muon://auth/callback?code=abc&state=xyz')).toEqual({
      code: 'abc',
      state: 'xyz',
    })
  })

  it('rejects non-auth deeplinks', () => {
    expect(parseEnterpriseAuthCallback('muon://settings')).toBeNull()
  })

  it('detects enterprise auth callbacks from desktop deeplink URLs', () => {
    expect(isEnterpriseAuthCallbackUrl('muon://auth/callback?code=abc&state=xyz')).toBe(true)
    expect(isEnterpriseAuthCallbackUrl('muon://settings')).toBe(false)
    expect(isEnterpriseAuthCallbackUrl('https://muon.local/auth/callback?code=abc&state=xyz')).toBe(false)
  })

  it('extracts the callback URL from second-instance argv', () => {
    expect(
      extractEnterpriseAuthCallbackUrl([
        '/Applications/Muon.app/Contents/MacOS/Muon',
        '--some-electron-flag',
        'muon://auth/callback?code=abc&state=xyz',
      ]),
    ).toBe('muon://auth/callback?code=abc&state=xyz')
  })
})

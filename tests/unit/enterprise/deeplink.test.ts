import { describe, expect, it } from 'vitest'
import { parseEnterpriseAuthCallback } from '../../../src/matrix/auth'

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
})

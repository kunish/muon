import {
  adminSessionSchema,
  installRequestSchema,
  muonSessionSchema,
  oauthTokenResponseSchema,
  userRoleSchema,
} from '@muon/enterprise-contracts'
import { describe, expect, it } from 'vitest'

describe('enterprise contracts', () => {
  it('validates install requests for first-run setup', () => {
    const result = installRequestSchema.safeParse({
      organizationName: 'Acme Research',
      organizationSlug: 'acme',
      ownerUsername: 'owner',
      ownerEmail: 'owner@acme.test',
      ownerDisplayName: 'Owner',
      ownerPassword: 'correct horse battery staple',
    })

    expect(result.success).toBe(true)
  })

  it('rejects invalid role names', () => {
    expect(userRoleSchema.safeParse('owner').success).toBe(true)
    expect(userRoleSchema.safeParse('superuser').success).toBe(false)
  })

  it('keeps desktop token exchange compatible with matrix auth storage', () => {
    const result = oauthTokenResponseSchema.safeParse({
      muonSession: {
        accessToken: 'muon-access',
        refreshToken: 'muon-refresh',
        expiresAt: '2026-05-02T12:00:00.000Z',
        deviceName: 'Muon Desktop',
      },
      matrixSession: {
        serverUrl: 'http://127.0.0.1:6167',
        userId: '@owner:localhost',
        accessToken: 'matrix-token',
        deviceId: 'MUONDEVICE',
      },
    })

    expect(result.success).toBe(true)
  })
})

describe('muonSessionSchema', () => {
  it('requires deviceName', () => {
    const result = muonSessionSchema.safeParse({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: '2030-01-01T00:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a session with deviceName', () => {
    const result = muonSessionSchema.safeParse({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: '2030-01-01T00:00:00.000Z',
      deviceName: 'Muon Desktop',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a whitespace-only deviceName', () => {
    const result = muonSessionSchema.safeParse({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: '2030-01-01T00:00:00.000Z',
      deviceName: '   ',
    })
    expect(result.success).toBe(false)
  })
})

describe('adminSessionSchema', () => {
  it('does not require a deviceName because Admin Web sessions are not DeviceSessions', () => {
    const result = adminSessionSchema.safeParse({
      accessToken: 'admin-access',
      refreshToken: 'admin-refresh',
      expiresAt: '2030-01-01T00:00:00.000Z',
    })

    expect(result.success).toBe(true)
  })
})

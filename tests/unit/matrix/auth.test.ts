import { describe, expect, it, vi } from 'vitest'

const mockLogin = vi.fn().mockResolvedValue({
  user_id: '@test:localhost',
  access_token: 'mock_token',
  device_id: 'MOCK_DEVICE',
})
const mockLogout = vi.fn().mockResolvedValue(undefined)
const mockStopSync = vi.fn()
const mockUnbindClientEvents = vi.fn()
const mockDestroyClient = vi.fn()
const mockRegister = vi.fn().mockResolvedValue({
  user_id: '@test:localhost',
  access_token: 'mock_token',
  device_id: 'MOCK_DEVICE',
})
const mockSetDisplayName = vi.fn().mockResolvedValue(undefined)
const mockOpenUrl = vi.fn().mockResolvedValue(undefined)
const mockFetch = vi.fn()

vi.mock('@matrix/client', () => ({
  createClient: vi.fn(() => ({
    login: mockLogin,
    logout: mockLogout,
    register: mockRegister,
    setDisplayName: mockSetDisplayName,
  })),
  getClient: vi.fn(() => ({
    logout: mockLogout,
    setDisplayName: mockSetDisplayName,
  })),
  destroyClient: mockDestroyClient,
}))

vi.mock('@/electron/opener', () => ({
  openUrl: mockOpenUrl,
}))

vi.mock('@/matrix/sync', () => ({
  stopSync: mockStopSync,
}))

vi.mock('@/matrix/events', () => ({
  unbindClientEvents: mockUnbindClientEvents,
}))

describe('auth', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })

  it('should login and persist session', async () => {
    const { login } = await import('@/matrix/auth')

    const session = await login('https://matrix.localhost', {
      username: 'testuser',
      password: 'testpass',
    })

    expect(mockLogin).toHaveBeenCalledWith('m.login.password', {
      identifier: {
        type: 'm.id.user',
        user: 'testuser',
      },
      password: 'testpass',
    })
    expect(session.userId).toBe('@test:localhost')
    expect(session.accessToken).toBe('mock_token')

    const stored = JSON.parse(localStorage.getItem('muon_auth')!)
    expect(stored.userId).toBe('@test:localhost')
  })

  it('should clear session on logout', async () => {
    localStorage.setItem('muon_auth', JSON.stringify({
      serverUrl: 'https://matrix.localhost',
      userId: '@test:localhost',
      accessToken: 'mock_token',
      deviceId: 'MOCK_DEVICE',
    }))

    const { logout } = await import('@/matrix/auth')
    await logout()

    expect(mockLogout).toHaveBeenCalled()
    expect(localStorage.getItem('muon_auth')).toBeNull()
  })

  it('should stop sync, unbind client events, and destroy the client on logout', async () => {
    localStorage.setItem('muon_auth', JSON.stringify({
      serverUrl: 'https://matrix.localhost',
      userId: '@test:localhost',
      accessToken: 'mock_token',
      deviceId: 'MOCK_DEVICE',
    }))

    const { logout } = await import('@/matrix/auth')
    await logout()

    expect(mockStopSync).toHaveBeenCalledOnce()
    expect(mockLogout).toHaveBeenCalledWith(true)
    expect(mockUnbindClientEvents).toHaveBeenCalledOnce()
    expect(mockDestroyClient).toHaveBeenCalledOnce()
    expect(localStorage.getItem('muon_auth')).toBeNull()
  })

  it('should restore session from localStorage', async () => {
    localStorage.setItem('muon_auth', JSON.stringify({
      serverUrl: 'https://matrix.localhost',
      userId: '@test:localhost',
      accessToken: 'mock_token',
      deviceId: 'MOCK_DEVICE',
    }))

    const { restoreSession } = await import('@/matrix/auth')
    const result = restoreSession()

    expect(result).toBe(true)
  })

  it('should return false when no stored session', async () => {
    const { restoreSession } = await import('@/matrix/auth')
    const result = restoreSession()

    expect(result).toBe(false)
  })

  it('starts enterprise SSO with desktop OAuth parameters', async () => {
    const { startEnterpriseLogin } = await import('@/matrix/auth')

    await startEnterpriseLogin('http://127.0.0.1:8787/')

    expect(mockOpenUrl).toHaveBeenCalledOnce()
    const authorizeUrl = new URL(mockOpenUrl.mock.calls[0][0])
    expect(authorizeUrl.origin).toBe('http://127.0.0.1:8787')
    expect(authorizeUrl.pathname).toBe('/api/oauth/authorize')
    expect(authorizeUrl.searchParams.get('client_id')).toBe('muon-desktop')
    expect(authorizeUrl.searchParams.get('redirect_uri')).toBe('muon://auth/callback')
    expect(authorizeUrl.searchParams.get('response_type')).toBe('code')
    expect(authorizeUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(authorizeUrl.searchParams.get('code_challenge')).toBeTruthy()
    expect(authorizeUrl.searchParams.get('state')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('muon_enterprise_pkce')!)).toMatchObject({
      state: authorizeUrl.searchParams.get('state'),
    })
  })

  it('completes enterprise SSO from a deeplink and stores the client session', async () => {
    const { completeEnterpriseLogin } = await import('@/matrix/auth')
    localStorage.setItem('muon_enterprise_pkce', JSON.stringify({
      codeVerifier: 'pkce-verifier',
      state: 'oauth-state',
    }))
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      matrixSession: {
        accessToken: 'matrix-token',
        deviceId: 'MUONDEVICE',
        serverUrl: 'http://127.0.0.1:6167',
        userId: '@owner:localhost',
      },
      muonSession: {
        accessToken: 'muon-token',
        expiresAt: new Date('2026-06-01T00:00:00.000Z').toISOString(),
        refreshToken: 'refresh-token',
      },
    }), {
      headers: { 'content-type': 'application/json' },
      status: 200,
    }))

    const session = await completeEnterpriseLogin(
      'muon://auth/callback?code=oauth-code&state=oauth-state',
      'http://127.0.0.1:8787/',
    )

    expect(mockFetch).toHaveBeenCalledOnce()
    const [tokenUrl, tokenRequest] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(tokenUrl).toBe('http://127.0.0.1:8787/api/oauth/token')
    expect(tokenRequest).toMatchObject({
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    expect(JSON.parse(String(tokenRequest.body))).toEqual({
      clientId: 'muon-desktop',
      code: 'oauth-code',
      codeVerifier: 'pkce-verifier',
      deviceName: 'Muon Desktop',
      redirectUri: 'muon://auth/callback',
    })
    expect(session).toEqual({
      accessToken: 'matrix-token',
      deviceId: 'MUONDEVICE',
      serverUrl: 'http://127.0.0.1:6167',
      userId: '@owner:localhost',
    })
    expect(JSON.parse(localStorage.getItem('muon_auth')!)).toEqual(session)
    expect(JSON.parse(localStorage.getItem('muon_enterprise_session')!)).toMatchObject({
      accessToken: 'muon-token',
      refreshToken: 'refresh-token',
    })
    expect(localStorage.getItem('muon_enterprise_pkce')).toBeNull()
  })
})

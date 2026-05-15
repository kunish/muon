import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    const result = await restoreSession()

    expect(result).toBe(true)
  })

  it('should return false when no stored session', async () => {
    const { restoreSession } = await import('@/matrix/auth')
    const result = await restoreSession()

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

const ENTERPRISE_SESSION_KEY = 'muon_enterprise_session'

describe('refreshEnterpriseSession', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('posts the stored refresh token and persists the new muon session', async () => {
    window.localStorage.setItem(ENTERPRISE_SESSION_KEY, JSON.stringify({
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    }))

    const newPayload = {
      muonSession: {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresAt: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
      },
      matrixSession: {
        serverUrl: 'http://localhost:6167',
        userId: '@acme.owner:localhost',
        accessToken: 'mx-1',
        deviceId: 'D1',
      },
    }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(newPayload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { refreshEnterpriseSession } = await import('@/matrix/auth')
    await refreshEnterpriseSession('http://muon.test')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://muon.test/api/oauth/refresh',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          refreshToken: 'old-refresh',
          clientId: 'muon-desktop',
          deviceName: 'Muon Desktop',
        }),
      }),
    )

    const stored = JSON.parse(window.localStorage.getItem(ENTERPRISE_SESSION_KEY) ?? '{}')
    expect(stored.accessToken).toBe('new-access')
    expect(stored.refreshToken).toBe('new-refresh')
  })

  it('clears the enterprise session when refresh returns 400', async () => {
    window.localStorage.setItem(ENTERPRISE_SESSION_KEY, JSON.stringify({
      accessToken: 'old-access',
      refreshToken: 'stale-refresh',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    }))

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Invalid refresh token' }), { status: 400 })))

    const { refreshEnterpriseSession } = await import('@/matrix/auth')
    await refreshEnterpriseSession('http://muon.test')

    expect(window.localStorage.getItem(ENTERPRISE_SESSION_KEY)).toBe(null)
  })

  it('is a no-op when no enterprise session is stored', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { refreshEnterpriseSession } = await import('@/matrix/auth')
    await refreshEnterpriseSession('http://muon.test')

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('maybeRefreshOnStartup', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('refreshes when expiry is within 24h', async () => {
    window.localStorage.setItem(ENTERPRISE_SESSION_KEY, JSON.stringify({
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
    }))

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      muonSession: {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresAt: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
      },
      matrixSession: {
        serverUrl: 'http://localhost:6167',
        userId: '@acme.owner:localhost',
        accessToken: 'mx-1',
        deviceId: 'D1',
      },
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_MUON_API_BASE_URL', 'http://muon.test')

    const { maybeRefreshOnStartup } = await import('@/matrix/auth')
    await maybeRefreshOnStartup()

    expect(fetchMock).toHaveBeenCalled()
    const stored = JSON.parse(window.localStorage.getItem(ENTERPRISE_SESSION_KEY) ?? '{}')
    expect(stored.accessToken).toBe('new-access')
  })

  it('does not refresh when expiry is far away', async () => {
    window.localStorage.setItem(ENTERPRISE_SESSION_KEY, JSON.stringify({
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresAt: new Date(Date.now() + 25 * 24 * 3600_000).toISOString(),
    }))

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { maybeRefreshOnStartup } = await import('@/matrix/auth')
    await maybeRefreshOnStartup()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is a no-op when no enterprise session is stored', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { maybeRefreshOnStartup } = await import('@/matrix/auth')
    await maybeRefreshOnStartup()

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

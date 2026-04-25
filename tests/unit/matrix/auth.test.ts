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
})

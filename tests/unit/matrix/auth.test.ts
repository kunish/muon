import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockLogin = vi.fn().mockResolvedValue({
  user_id: '@test:localhost',
  access_token: 'mock_token',
  device_id: 'MOCK_DEVICE',
})
const mockLogout = vi.fn().mockResolvedValue(undefined)
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

vi.mock('@/matrix/events', () => ({
  unbindClientEvents: mockUnbindClientEvents,
}))

describe('auth', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('should login and persist session', async () => {
    const { loginWithPassword } = await import('@/matrix/auth')

    const session = await loginWithPassword('https://matrix.localhost', {
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

    const { logoutMatrix } = await import('@/matrix/auth')
    await logoutMatrix()

    expect(mockLogout).toHaveBeenCalled()
    expect(localStorage.getItem('muon_auth')).toBeNull()
  })

  it('should unbind client events and destroy the client on logout', async () => {
    localStorage.setItem('muon_auth', JSON.stringify({
      serverUrl: 'https://matrix.localhost',
      userId: '@test:localhost',
      accessToken: 'mock_token',
      deviceId: 'MOCK_DEVICE',
    }))

    const { logoutMatrix } = await import('@/matrix/auth')
    await logoutMatrix()

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

    const { restoreMatrixSession } = await import('@/matrix/auth')
    const result = await restoreMatrixSession()

    expect(result).not.toBeNull()
    expect(result?.userId).toBe('@test:localhost')
  })

  it('should return null when no stored session', async () => {
    const { restoreMatrixSession } = await import('@/matrix/auth')
    const result = await restoreMatrixSession()

    expect(result).toBeNull()
  })
})

describe('activateMatrixSession', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('persists the session to muon_auth and creates the client', async () => {
    const { activateMatrixSession } = await import('@/matrix/auth')
    const { createClient } = await import('@matrix/client')
    const session = {
      serverUrl: 'https://matrix.example.com',
      userId: '@u:example.com',
      accessToken: 'at',
      deviceId: 'DEV',
    }

    await activateMatrixSession(session)

    expect(localStorage.getItem('muon_auth')).not.toBeNull()
    const stored = JSON.parse(localStorage.getItem('muon_auth')!)
    expect(stored).toEqual(session)
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(createClient).toHaveBeenCalledWith(session)
  })
})

describe('readMatrixSessionFromStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('returns null when no session is stored', async () => {
    const { readMatrixSessionFromStore } = await import('@/matrix/auth')
    const { createClient } = await import('@matrix/client')
    expect(await readMatrixSessionFromStore()).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('returns the stored session without creating a client', async () => {
    const { activateMatrixSession, readMatrixSessionFromStore } = await import('@/matrix/auth')
    const { createClient } = await import('@matrix/client')
    const session = {
      serverUrl: 'https://matrix.example.com',
      userId: '@u:example.com',
      accessToken: 'at',
      deviceId: 'DEV',
    }
    await activateMatrixSession(session)
    vi.clearAllMocks()

    const read = await readMatrixSessionFromStore()
    expect(read).toEqual(session)
    expect(createClient).not.toHaveBeenCalled()
  })
})

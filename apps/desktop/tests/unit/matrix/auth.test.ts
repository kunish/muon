import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.unmock('@matrix/client')

const mockLogin = vi.fn().mockResolvedValue({
  user_id: '@test:localhost',
  access_token: 'mock_token',
  device_id: 'MOCK_DEVICE',
})
const mockRegister = vi.fn().mockResolvedValue({
  user_id: '@test:localhost',
  access_token: 'mock_token',
  device_id: 'MOCK_DEVICE',
})
const mockSetDisplayName = vi.fn().mockResolvedValue(undefined)
const mockSdkCreateClient = vi.fn(() => ({
  login: mockLogin,
  register: mockRegister,
  setDisplayName: mockSetDisplayName,
  stopClient: vi.fn(),
}))

vi.mock('matrix-js-sdk', () => ({
  createClient: mockSdkCreateClient,
}))

vi.mock('@/desktop/http', () => ({
  fetch: vi.fn(),
}))

describe('matrix auth credential exchange', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('logs in and returns a MatrixSession without persisting or activating the singleton client', async () => {
    const { loginWithPassword } = await import('@/matrix/auth')

    const session = await loginWithPassword('https://matrix.localhost', {
      username: '@testuser:localhost',
      password: 'testpass',
    })

    expect(mockLogin).toHaveBeenCalledWith('m.login.password', {
      identifier: {
        type: 'm.id.user',
        user: 'testuser',
      },
      password: 'testpass',
    })
    expect(session).toEqual({
      serverUrl: 'https://matrix.localhost',
      userId: '@test:localhost',
      accessToken: 'mock_token',
      deviceId: 'MOCK_DEVICE',
    })
    expect(localStorage.getItem('muon_auth')).toBeNull()
  })

  it('registers and returns a MatrixSession without setting profile data or persisting locally', async () => {
    const { register } = await import('@/matrix/auth')

    const session = await register('https://matrix.localhost', {
      username: 'testuser',
      password: 'testpass',
      displayName: 'Ada',
    })

    expect(mockRegister).toHaveBeenCalledWith('testuser', 'testpass', null, { type: 'm.login.dummy' })
    expect(session.userId).toBe('@test:localhost')
    expect(mockSetDisplayName).not.toHaveBeenCalled()
    expect(localStorage.getItem('muon_auth')).toBeNull()
  })
})

describe('activateMatrixSession', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('persists the session to muon_auth and creates the singleton client', async () => {
    const { activateMatrixSession } = await import('@/matrix/auth')
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
    expect(mockSdkCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'at',
        baseUrl: 'https://matrix.example.com',
        deviceId: 'DEV',
        userId: '@u:example.com',
      }),
    )
  })
})

describe('readMatrixSessionFromStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('returns null when no session is stored', async () => {
    const { readMatrixSessionFromStore } = await import('@/matrix/auth')

    expect(await readMatrixSessionFromStore()).toBeNull()
    expect(mockSdkCreateClient).not.toHaveBeenCalled()
  })

  it('returns the stored session without creating a client', async () => {
    const { activateMatrixSession, readMatrixSessionFromStore } = await import('@/matrix/auth')
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
    expect(mockSdkCreateClient).not.toHaveBeenCalled()
  })
})

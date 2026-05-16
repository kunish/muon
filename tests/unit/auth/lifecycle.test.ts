import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockStart = vi.fn()
const mockComplete = vi.fn()
const mockRestore = vi.fn()
const mockClear = vi.fn()
const mockLoginWithPassword = vi.fn()
const mockRestoreMatrixSession = vi.fn()
const mockLogoutMatrix = vi.fn()
const mockActivateMatrixSession = vi.fn()
const mockBindClientEvents = vi.fn()
const mockUnbindClientEvents = vi.fn()
const mockStartSync = vi.fn()
const mockStopSync = vi.fn()

vi.mock('@/enterprise/session', () => ({
  start: mockStart,
  complete: mockComplete,
  restore: mockRestore,
  clear: mockClear,
  defaultEnterpriseSessionDeps: vi.fn(() => ({ apiBaseUrl: 'https://api.example.com' })),
  isEnterpriseAuthConfigured: vi.fn(() => true),
}))

vi.mock('@matrix/index', () => ({
  loginWithPassword: mockLoginWithPassword,
  restoreMatrixSession: mockRestoreMatrixSession,
  logoutMatrix: mockLogoutMatrix,
  activateMatrixSession: mockActivateMatrixSession,
  bindClientEvents: mockBindClientEvents,
  unbindClientEvents: mockUnbindClientEvents,
  startSync: mockStartSync,
  stopSync: mockStopSync,
}))

describe('lifecycle.bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns restored=false when no session of any kind exists', async () => {
    mockRestore.mockResolvedValue(null)
    mockRestoreMatrixSession.mockResolvedValue(null)

    const { bootstrap } = await import('@/auth/lifecycle')
    const result = await bootstrap()

    expect(result.restored).toBe(false)
    expect(mockBindClientEvents).not.toHaveBeenCalled()
    expect(mockStartSync).not.toHaveBeenCalled()
  })

  it('activates Matrix client, binds events, and starts sync when EnterpriseSession restores', async () => {
    mockRestore.mockResolvedValue({
      muon: { accessToken: 'a', refreshToken: 'r', expiresAt: '2030-01-01T00:00:00.000Z', deviceName: 'D' },
      matrix: { serverUrl: 'm', userId: '@u:m', accessToken: 'ma', deviceId: 'd' },
    })

    const { bootstrap } = await import('@/auth/lifecycle')
    const result = await bootstrap()

    expect(result.restored).toBe(true)
    expect(mockActivateMatrixSession).toHaveBeenCalledWith({
      serverUrl: 'm',
      userId: '@u:m',
      accessToken: 'ma',
      deviceId: 'd',
    })
    expect(mockBindClientEvents).toHaveBeenCalled()
    expect(mockStartSync).toHaveBeenCalled()
  })

  it('falls back to MatrixSession-only restore when no EnterpriseSession', async () => {
    mockRestore.mockResolvedValue(null)
    mockRestoreMatrixSession.mockResolvedValue({ serverUrl: 'm', userId: '@u:m', accessToken: 'ma', deviceId: 'd' })

    const { bootstrap } = await import('@/auth/lifecycle')
    const result = await bootstrap()

    expect(result.restored).toBe(true)
    expect(mockBindClientEvents).toHaveBeenCalled()
    expect(mockStartSync).toHaveBeenCalled()
  })
})

describe('lifecycle.signInWithPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs in with password then binds events and starts sync', async () => {
    mockLoginWithPassword.mockResolvedValue({ serverUrl: 's', userId: '@u:s', accessToken: 'a', deviceId: 'd' })

    const { signInWithPassword } = await import('@/auth/lifecycle')
    await signInWithPassword('https://matrix.example.com', { username: 'u', password: 'p' })

    expect(mockLoginWithPassword).toHaveBeenCalledWith('https://matrix.example.com', { username: 'u', password: 'p' })
    expect(mockBindClientEvents).toHaveBeenCalled()
    expect(mockStartSync).toHaveBeenCalled()
  })
})

describe('lifecycle.signInWithEnterprise', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('completes the enterprise flow, activates Matrix, binds events, starts sync', async () => {
    mockComplete.mockResolvedValue({
      muon: { accessToken: 'a', refreshToken: 'r', expiresAt: '2030-01-01T00:00:00.000Z', deviceName: 'D' },
      matrix: { serverUrl: 'm', userId: '@u:m', accessToken: 'ma', deviceId: 'd' },
    })

    const { signInWithEnterprise } = await import('@/auth/lifecycle')
    await signInWithEnterprise('muon://auth/callback?code=c&state=s')

    expect(mockComplete).toHaveBeenCalled()
    expect(mockActivateMatrixSession).toHaveBeenCalled()
    expect(mockBindClientEvents).toHaveBeenCalled()
    expect(mockStartSync).toHaveBeenCalled()
  })
})

describe('lifecycle.signOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stops sync, logs out of Matrix, clears EnterpriseSession storage', async () => {
    const calls: string[] = []
    mockStopSync.mockImplementation(() => {
      calls.push('stopSync')
    })
    mockLogoutMatrix.mockImplementation(async () => {
      calls.push('logoutMatrix')
    })
    mockClear.mockImplementation(() => {
      calls.push('enterprise.clear')
    })

    const { signOut } = await import('@/auth/lifecycle')
    await signOut()

    // stopSync first, then Matrix logout, then enterprise clear
    expect(calls).toEqual(['stopSync', 'logoutMatrix', 'enterprise.clear'])
  })
})

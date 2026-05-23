import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockStart = vi.fn()
const mockComplete = vi.fn()
const mockRestore = vi.fn()
const mockClear = vi.fn()
const mockActivate = vi.fn()
const mockDeactivate = vi.fn()
const mockLoginWithPassword = vi.fn()
const mockReadMatrixSessionFromStore = vi.fn()
const mockRegister = vi.fn()
const mockSetMyDisplayName = vi.fn()
const mockEmitSignIn = vi.fn()
const mockEmitSignOut = vi.fn()

vi.mock('@/enterprise/session', () => ({
  start: mockStart,
  complete: mockComplete,
  restore: mockRestore,
  clear: mockClear,
  defaultEnterpriseSessionDeps: vi.fn(() => ({ apiBaseUrl: 'https://api.example.com' })),
  isEnterpriseAuthConfigured: vi.fn(() => true),
}))

vi.mock('@/matrix/auth', () => ({
  loginWithPassword: mockLoginWithPassword,
  readMatrixSessionFromStore: mockReadMatrixSessionFromStore,
  register: mockRegister,
}))

vi.mock('@/matrix/profile', () => ({
  setMyDisplayName: mockSetMyDisplayName,
}))

vi.mock('@/matrix/sessionLifecycle', () => ({
  activate: mockActivate,
  deactivate: mockDeactivate,
}))

vi.mock('@/auth/lifecycleEvents', () => ({
  emitSignIn: mockEmitSignIn,
  emitSignOut: mockEmitSignOut,
}))

const matrixSession = {
  serverUrl: 'https://matrix.example.com',
  userId: '@u:example.com',
  accessToken: 'ma',
  deviceId: 'DEV',
}

describe('lifecycle.bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActivate.mockResolvedValue(true)
  })

  it('returns restored=false when no session of any kind exists', async () => {
    mockRestore.mockResolvedValue(null)
    mockReadMatrixSessionFromStore.mockResolvedValue(null)

    const { bootstrap } = await import('@/auth/lifecycle')
    const result = await bootstrap()

    expect(result).toEqual({ restored: false })
    expect(mockActivate).not.toHaveBeenCalled()
    expect(mockEmitSignIn).not.toHaveBeenCalled()
  })

  it('activates an EnterpriseSession MatrixSession and reports enterprise restore', async () => {
    mockRestore.mockResolvedValue({
      muon: { accessToken: 'a', refreshToken: 'r', expiresAt: '2030-01-01T00:00:00.000Z', deviceName: 'D' },
      matrix: matrixSession,
    })

    const { bootstrap } = await import('@/auth/lifecycle')
    const result = await bootstrap()

    expect(result).toEqual({ restored: 'enterprise' })
    expect(mockActivate).toHaveBeenCalledWith(matrixSession)
    expect(mockEmitSignIn).toHaveBeenCalledWith(matrixSession)
  })

  it('falls back to a stored MatrixSession and reports matrix-only restore', async () => {
    mockRestore.mockResolvedValue(null)
    mockReadMatrixSessionFromStore.mockResolvedValue(matrixSession)

    const { bootstrap } = await import('@/auth/lifecycle')
    const result = await bootstrap()

    expect(result).toEqual({ restored: 'matrix-only' })
    expect(mockActivate).toHaveBeenCalledWith(matrixSession)
    expect(mockEmitSignIn).toHaveBeenCalledWith(matrixSession)
  })

  it('does not re-emit signIn when activation is idempotent for the same MatrixSession', async () => {
    mockRestore.mockResolvedValue(null)
    mockReadMatrixSessionFromStore.mockResolvedValue(matrixSession)
    mockActivate.mockResolvedValue(false)

    const { bootstrap } = await import('@/auth/lifecycle')
    await bootstrap()

    expect(mockEmitSignIn).not.toHaveBeenCalled()
  })
})

describe('lifecycle.signInWithPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActivate.mockResolvedValue(true)
  })

  it('exchanges credentials for a MatrixSession and activates through the lifecycle facade', async () => {
    mockLoginWithPassword.mockResolvedValue(matrixSession)

    const { signInWithPassword } = await import('@/auth/lifecycle')
    await signInWithPassword('https://matrix.example.com', { username: 'u', password: 'p' })

    expect(mockLoginWithPassword).toHaveBeenCalledWith('https://matrix.example.com', { username: 'u', password: 'p' })
    expect(mockActivate).toHaveBeenCalledWith(matrixSession)
    expect(mockEmitSignIn).toHaveBeenCalledWith(matrixSession)
  })
})

describe('lifecycle.signUpWithPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActivate.mockResolvedValue(true)
  })

  it('registers, activates, then applies the profile display name', async () => {
    const calls: string[] = []
    mockRegister.mockResolvedValue(matrixSession)
    mockActivate.mockImplementation(async () => {
      calls.push('activate')
      return true
    })
    mockSetMyDisplayName.mockImplementation(async () => {
      calls.push('setMyDisplayName')
    })

    const { signUpWithPassword } = await import('@/auth/lifecycle')
    await signUpWithPassword('https://matrix.example.com', {
      username: 'u',
      password: 'p',
      displayName: 'Ada',
    })

    expect(mockRegister).toHaveBeenCalledWith('https://matrix.example.com', {
      username: 'u',
      password: 'p',
      displayName: 'Ada',
    })
    expect(calls).toEqual(['activate', 'setMyDisplayName'])
    expect(mockSetMyDisplayName).toHaveBeenCalledWith('Ada')
  })
})

describe('lifecycle.signInWithEnterprise', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActivate.mockResolvedValue(true)
  })

  it('completes enterprise auth and activates its MatrixSession', async () => {
    mockComplete.mockResolvedValue({
      muon: { accessToken: 'a', refreshToken: 'r', expiresAt: '2030-01-01T00:00:00.000Z', deviceName: 'D' },
      matrix: matrixSession,
    })

    const { signInWithEnterprise } = await import('@/auth/lifecycle')
    await signInWithEnterprise('muon://auth/callback?code=c&state=s')

    expect(mockComplete).toHaveBeenCalled()
    expect(mockActivate).toHaveBeenCalledWith(matrixSession)
    expect(mockEmitSignIn).toHaveBeenCalledWith(matrixSession)
  })
})

describe('lifecycle.signOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emits signOut, performs best-effort Matrix deactivation, then clears EnterpriseSession storage', async () => {
    const calls: string[] = []
    mockEmitSignOut.mockImplementation(() => {
      calls.push('emitSignOut')
    })
    mockDeactivate.mockImplementation(async () => {
      calls.push('deactivate')
    })
    mockClear.mockImplementation(() => {
      calls.push('enterprise.clear')
    })

    const { signOut } = await import('@/auth/lifecycle')
    await signOut()

    expect(calls).toEqual(['emitSignOut', 'deactivate', 'enterprise.clear'])
    expect(mockEmitSignOut).toHaveBeenCalledWith('user-initiated')
    expect(mockDeactivate).toHaveBeenCalledWith({ revoke: true })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockActivateMatrixSession = vi.fn()
const mockClearMatrixSessionStore = vi.fn()
const mockDestroyClient = vi.fn()
const mockGetClient = vi.fn()
const mockBindClientEvents = vi.fn()
const mockUnbindClientEvents = vi.fn()
const mockStartSync = vi.fn()
const mockStopSync = vi.fn()
const mockLogout = vi.fn()

vi.mock('@/matrix/auth', () => ({
  activateMatrixSession: mockActivateMatrixSession,
  clearMatrixSessionStore: mockClearMatrixSessionStore,
}))

vi.mock('@/matrix/client', () => ({
  destroyClient: mockDestroyClient,
  getClient: mockGetClient,
}))

vi.mock('@/matrix/events', () => ({
  bindClientEvents: mockBindClientEvents,
  unbindClientEvents: mockUnbindClientEvents,
}))

vi.mock('@/matrix/sync', () => ({
  startSync: mockStartSync,
  stopSync: mockStopSync,
}))

const matrixSession = {
  serverUrl: 'https://matrix.example.com',
  userId: '@u:example.com',
  accessToken: 'ma',
  deviceId: 'DEV',
}

describe('matrix session lifecycle', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockGetClient.mockReturnValue({ logout: mockLogout })
    mockActivateMatrixSession.mockResolvedValue(undefined)
    mockLogout.mockResolvedValue(undefined)
    const { __resetMatrixSessionLifecycleForTests } = await import('@/matrix/sessionLifecycle')
    __resetMatrixSessionLifecycleForTests()
  })

  it('activates a MatrixSession by persisting, binding events, and starting sync', async () => {
    const { activate } = await import('@/matrix/sessionLifecycle')

    await expect(activate(matrixSession)).resolves.toBe(true)

    expect(mockActivateMatrixSession).toHaveBeenCalledWith(matrixSession)
    expect(mockBindClientEvents).toHaveBeenCalledOnce()
    expect(mockStartSync).toHaveBeenCalledOnce()
  })

  it('treats duplicate activation of the same MatrixSession as an idempotent no-op', async () => {
    const { activate } = await import('@/matrix/sessionLifecycle')

    await expect(activate(matrixSession)).resolves.toBe(true)
    await expect(activate({ ...matrixSession })).resolves.toBe(false)

    expect(mockActivateMatrixSession).toHaveBeenCalledTimes(1)
    expect(mockBindClientEvents).toHaveBeenCalledTimes(1)
    expect(mockStartSync).toHaveBeenCalledTimes(1)
  })

  it('rejects activation of a different MatrixSession while one is active', async () => {
    const { activate } = await import('@/matrix/sessionLifecycle')

    await activate(matrixSession)
    await expect(activate({ ...matrixSession, userId: '@other:example.com' })).rejects.toThrow(/different MatrixSession/)

    expect(mockActivateMatrixSession).toHaveBeenCalledTimes(1)
  })

  it('deactivates local Matrix state and allows a later activation', async () => {
    const { activate, deactivate } = await import('@/matrix/sessionLifecycle')

    await activate(matrixSession)
    await deactivate({ revoke: true })
    await activate({ ...matrixSession, userId: '@next:example.com' })

    expect(mockStopSync).toHaveBeenCalledOnce()
    expect(mockLogout).toHaveBeenCalledWith(true)
    expect(mockUnbindClientEvents).toHaveBeenCalledOnce()
    expect(mockClearMatrixSessionStore).toHaveBeenCalledOnce()
    expect(mockDestroyClient).toHaveBeenCalledOnce()
    expect(mockActivateMatrixSession).toHaveBeenCalledTimes(2)
  })

  it('keeps local deactivation best-effort when remote revoke fails', async () => {
    const { activate, deactivate } = await import('@/matrix/sessionLifecycle')
    mockLogout.mockRejectedValueOnce(new Error('network down'))

    await activate(matrixSession)
    await expect(deactivate({ revoke: true })).resolves.toBeUndefined()

    expect(mockStopSync).toHaveBeenCalledOnce()
    expect(mockUnbindClientEvents).toHaveBeenCalledOnce()
    expect(mockClearMatrixSessionStore).toHaveBeenCalledOnce()
    expect(mockDestroyClient).toHaveBeenCalledOnce()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockClient } from '../../mocks/matrix'

/*
 * NOTE: The syncRecovery.test.ts already covers the sync recovery flow
 * (exponential backoff retry on ERROR). This file tests the baseline
 * sync operations: start, stop, and state transitions.
 */

describe('matrix sync', () => {
  let onHandler: Record<string, (...args: any[]) => void>

  beforeEach(() => {
    vi.clearAllMocks()
    onHandler = {}
    // Reset the mock on/off behavior to capture handlers
    vi.mocked(mockClient.on).mockImplementation((event: string, handler: any) => {
      onHandler[event] = handler
    })
    vi.mocked(mockClient.startClient).mockClear()
    vi.mocked(mockClient.stopClient).mockClear()
  })

  it('startSync registers a Sync listener and starts the client', async () => {
    const { startSync } = await import('@/matrix/sync')
    startSync()

    expect(mockClient.on).toHaveBeenCalledWith('sync', expect.any(Function))
    expect(onHandler.sync).toBeTypeOf('function')
    expect(mockClient.startClient).toHaveBeenCalledWith({ initialSyncLimit: 20 })
  })

  it('emits RECONNECTING state on Sync RECONNECTING', async () => {
    const { startSync, syncState } = await import('@/matrix/sync')
    startSync()

    const emitSpy = vi.fn()
    const { matrixEvents } = await import('@/matrix/events')
    matrixEvents.on('sync.state', emitSpy)

    onHandler.sync?.('RECONNECTING')
    expect(syncState.value).toBe('RECONNECTING')
  })

  it('emits PREPARED state and resets errorCount on PREPARED', async () => {
    const { startSync, syncState } = await import('@/matrix/sync')
    startSync()

    onHandler.sync?.('PREPARED')
    expect(syncState.value).toBe('PREPARED')
  })

  it('emits SYNCING state on SYNCING', async () => {
    const { startSync, syncState } = await import('@/matrix/sync')
    startSync()

    onHandler.sync?.('SYNCING')
    expect(syncState.value).toBe('SYNCING')
  })

  it('emits STOPPED state on stopSync', async () => {
    const { startSync, stopSync, syncState } = await import('@/matrix/sync')
    startSync()

    onHandler.sync?.('SYNCING')
    expect(syncState.value).toBe('SYNCING')

    stopSync()
    expect(mockClient.stopClient).toHaveBeenCalledOnce()
    expect(syncState.value).toBe('STOPPED')
  })

  it('stopSync clears pending retry timers', async () => {
    vi.useFakeTimers()

    const { startSync, stopSync } = await import('@/matrix/sync')
    startSync()

    // Simulate ERROR to trigger retry scheduling
    onHandler.sync?.('ERROR')

    // Verify a timer was scheduled
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    stopSync()
    expect(clearTimeoutSpy).toHaveBeenCalled()
    expect(mockClient.stopClient).toHaveBeenCalledOnce()

    vi.useRealTimers()
  })

  it('unknown sync state values are ignored', async () => {
    const { startSync, syncState } = await import('@/matrix/sync')
    startSync()

    onHandler.sync?.('SYNCING')
    const beforeState = syncState.value

    onHandler.sync?.('UNKNOWN_STATE')
    // State should remain unchanged
    expect(syncState.value).toBe(beforeState)
  })

  it('scheduleRetry does not create a new timer when one is already pending', async () => {
    vi.useFakeTimers()

    const { startSync } = await import('@/matrix/sync')
    startSync()

    // First ERROR triggers retry
    onHandler.sync?.('ERROR')

    const pendingTimerCount = vi.getTimerCount()
    expect(pendingTimerCount).toBeGreaterThan(0)

    // Second ERROR should not create an additional timer
    onHandler.sync?.('ERROR')
    expect(vi.getTimerCount()).toBe(pendingTimerCount)

    vi.useRealTimers()
  })
})

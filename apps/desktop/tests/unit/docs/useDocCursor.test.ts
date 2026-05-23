import type { MatrixSyncProvider } from '@/features/docs/services/matrixSyncProvider'
import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useDocCursor } from '@/features/docs/composables/useDocCursor'

describe('useDocCursor', () => {
  it('sends local cursor updates through the active provider', () => {
    const sendCursor = vi.fn()
    const provider = {
      sendCursor,
      onCursor: vi.fn(() => vi.fn()),
    } as unknown as MatrixSyncProvider

    const cursor = useDocCursor(() => provider, '@me:localhost', 'Me')

    cursor.updateLocalCursor(4, 9)

    expect(sendCursor).toHaveBeenCalledWith({
      userId: '@me:localhost',
      name: 'Me',
      color: expect.any(String),
      from: 4,
      to: 9,
    })
  })

  it('subscribes to provider cursor events and exposes remote collaborators', () => {
    let remoteHandler: ((cursor: {
      userId: string
      name: string
      color: string
      from: number
      to: number
    }) => void) | undefined
    const dispose = vi.fn()
    const provider = {
      sendCursor: vi.fn(),
      onCursor: vi.fn((handler) => {
        remoteHandler = handler
        return dispose
      }),
    } as unknown as MatrixSyncProvider

    const scope = effectScope()
    const cursor = scope.run(() => useDocCursor(() => provider, '@me:localhost', 'Me'))!

    remoteHandler?.({
      userId: '@alice:localhost',
      name: 'Alice',
      color: '#2563eb',
      from: 2,
      to: 7,
    })

    expect(cursor.others.value).toEqual([{
      userId: '@alice:localhost',
      name: 'Alice',
      color: '#2563eb',
      from: 2,
      to: 7,
    }])

    scope.stop()
    expect(dispose).toHaveBeenCalled()
  })
})

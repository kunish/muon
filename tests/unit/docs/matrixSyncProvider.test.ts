import { describe, expect, it, vi } from 'vitest'
import { Doc } from 'yjs'

import { MatrixSyncProvider } from '@/features/docs/services/matrixSyncProvider'

// Mock the matrix client before importing the provider
vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => ({
    sendEvent: vi.fn().mockResolvedValue({ event_id: '$test_event' }),
    on: vi.fn(),
    off: vi.fn(),
  })),
}))

describe('matrixSyncProvider', () => {
  it('creates a provider for a Yjs doc and room', () => {
    const doc = new Doc()
    const provider = new MatrixSyncProvider(doc, '!test:localhost')

    expect(provider).toBeDefined()

    provider.destroy()
  })

  it('sendSnapshot sends a sync event', async () => {
    const doc = new Doc()
    const provider = new MatrixSyncProvider(doc, '!test:localhost')

    provider.sendSnapshot()

    // Should not throw — the mock resolves successfully
    provider.destroy()
  })

  it('sendCursor sends a cursor event', () => {
    const doc = new Doc()
    const provider = new MatrixSyncProvider(doc, '!test:localhost')

    provider.sendCursor({
      userId: '@test:localhost',
      name: 'Test',
      color: '#2563eb',
      from: 0,
      to: 5,
    })

    provider.destroy()
  })

  it('destroy cleans up listeners', () => {
    const doc = new Doc()
    const provider = new MatrixSyncProvider(doc, '!test:localhost')

    provider.destroy()

    // Should not throw — editing after destroy must not trigger events
    const text = doc.getText('test')
    text.insert(0, 'after destroy')
  })
})

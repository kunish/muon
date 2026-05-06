import type { MatrixClient } from 'matrix-js-sdk'
import { RoomEvent } from 'matrix-js-sdk'
import { describe, expect, it, vi } from 'vitest'
import { Doc, encodeStateAsUpdate } from 'yjs'

import { MatrixSyncProvider } from '@/features/docs/services/matrixSyncProvider'
import { MATRIX_EVENT_TYPES } from '@/features/docs/types/doc'

// Mock the matrix client before importing the provider
vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => ({
    sendEvent: vi.fn().mockResolvedValue({ event_id: '$test_event' }),
    getRoom: vi.fn(() => null),
    on: vi.fn(),
    off: vi.fn(),
  })),
}))

const roomId = '!test:localhost'

function uint8ToBase64(uint8: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i])
  }
  return btoa(binary)
}

function createSyncContent(doc: Doc, batchId = 'batch-1') {
  return {
    type: 'full' as const,
    docId: roomId,
    seq: 0,
    total: 1,
    payload: uint8ToBase64(encodeStateAsUpdate(doc)),
    prevEventId: null,
    batchId,
  }
}

function createMatrixEvent(content: ReturnType<typeof createSyncContent>, eventId = '$sync') {
  return {
    getType: () => MATRIX_EVENT_TYPES.DOC_SYNC,
    getContent: () => content,
    getRoomId: () => roomId,
    getId: () => eventId,
  }
}

function createCursorMatrixEvent(content: {
  userId: string
  name: string
  color: string
  from: number
  to: number
}, targetRoomId = roomId) {
  return {
    getType: () => MATRIX_EVENT_TYPES.DOC_CURSOR,
    getContent: () => content,
    getRoomId: () => targetRoomId,
    getId: () => '$cursor',
  }
}

function createClient(events: unknown[] = []) {
  const timelineHandlers: Array<(event: unknown) => void> = []
  return {
    sendEvent: vi.fn().mockResolvedValue({ event_id: '$test_event' }),
    getRoom: vi.fn(() => ({
      getLiveTimeline: () => ({
        getEvents: () => events,
      }),
    })),
    on: vi.fn((eventName: string, handler: (event: unknown) => void) => {
      if (eventName === RoomEvent.Timeline)
        timelineHandlers.push(handler)
    }),
    off: vi.fn(),
    timelineHandlers,
  }
}

describe('matrixSyncProvider', () => {
  it('creates a provider for a Yjs doc and room', () => {
    const doc = new Doc()
    const provider = new MatrixSyncProvider(doc, roomId)

    expect(provider).toBeDefined()

    provider.destroy()
  })

  it('sendSnapshot sends a sync event', async () => {
    const doc = new Doc()
    const provider = new MatrixSyncProvider(doc, roomId)

    provider.sendSnapshot()

    // Should not throw — the mock resolves successfully
    provider.destroy()
  })

  it('sendCursor sends a cursor event', () => {
    const doc = new Doc()
    const provider = new MatrixSyncProvider(doc, roomId)

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
    const provider = new MatrixSyncProvider(doc, roomId)

    provider.destroy()

    // Should not throw — editing after destroy must not trigger events
    const text = doc.getText('test')
    text.insert(0, 'after destroy')
  })

  it('sends local Yjs document changes as Matrix sync events in real time', async () => {
    const doc = new Doc()
    const client = createClient()
    const provider = new MatrixSyncProvider(doc, roomId, client as unknown as MatrixClient)

    doc.getText('content').insert(0, '实时保存')
    await Promise.resolve()

    expect(client.sendEvent).toHaveBeenCalledWith(
      roomId,
      MATRIX_EVENT_TYPES.DOC_SYNC,
      expect.objectContaining({
        docId: roomId,
        payload: expect.any(String),
      }),
    )

    provider.destroy()
  })

  it('replays stored Matrix sync events when opening a document', () => {
    const sourceDoc = new Doc()
    sourceDoc.getText('content').insert(0, '已保存内容')
    const targetDoc = new Doc()
    const client = createClient([createMatrixEvent(createSyncContent(sourceDoc))])
    const provider = new MatrixSyncProvider(targetDoc, roomId, client as unknown as MatrixClient)

    expect(targetDoc.getText('content').toString()).toBe('已保存内容')

    provider.destroy()
  })

  it('applies Matrix SDK timeline sync events for live remote updates', () => {
    const sourceDoc = new Doc()
    sourceDoc.getText('content').insert(0, '远端内容')
    const targetDoc = new Doc()
    const client = createClient()
    const provider = new MatrixSyncProvider(targetDoc, roomId, client as unknown as MatrixClient)

    client.timelineHandlers[0]?.(createMatrixEvent(createSyncContent(sourceDoc), '$remote-sync'))

    expect(targetDoc.getText('content').toString()).toBe('远端内容')

    provider.destroy()
  })

  it('emits live remote cursor events to cursor subscribers', () => {
    const doc = new Doc()
    const client = createClient()
    const provider = new MatrixSyncProvider(doc, roomId, client as unknown as MatrixClient)
    const handler = vi.fn()

    provider.onCursor(handler)
    client.timelineHandlers[0]?.(createCursorMatrixEvent({
      userId: '@alice:localhost',
      name: 'Alice',
      color: '#2563eb',
      from: 3,
      to: 8,
    }))

    expect(handler).toHaveBeenCalledWith({
      userId: '@alice:localhost',
      name: 'Alice',
      color: '#2563eb',
      from: 3,
      to: 8,
    })

    provider.destroy()
  })

  it('ignores cursor events from other document rooms', () => {
    const doc = new Doc()
    const client = createClient()
    const provider = new MatrixSyncProvider(doc, roomId, client as unknown as MatrixClient)
    const handler = vi.fn()

    provider.onCursor(handler)
    client.timelineHandlers[0]?.(createCursorMatrixEvent({
      userId: '@alice:localhost',
      name: 'Alice',
      color: '#2563eb',
      from: 3,
      to: 8,
    }, '!other:localhost'))

    expect(handler).not.toHaveBeenCalled()

    provider.destroy()
  })
})

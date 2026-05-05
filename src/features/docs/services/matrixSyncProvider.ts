import type { MatrixClient } from 'matrix-js-sdk'
import { RoomEvent } from 'matrix-js-sdk'
import { Doc, applyUpdate, encodeStateAsUpdate } from 'yjs'
import type { DocSyncEvent, DocCursorEvent } from '../types/doc'
import { MATRIX_EVENT_TYPES } from '../types/doc'
import { getClient } from '@matrix/client'

const MAX_CHUNK_SIZE = 60 * 1024

export class MatrixSyncProvider {
  private doc: Doc
  private roomId: string
  private client: MatrixClient
  private lastEventId: string | null = null
  private pendingChunks = new Map<string, Uint8Array[]>()

  constructor(doc: Doc, roomId: string, client?: MatrixClient) {
    this.doc = doc
    this.roomId = roomId
    this.client = client ?? getClient()

    this.doc.on('update', this.handleYjsUpdate)
    this.client.on(RoomEvent.Timeline, this.handleTimelineEvent)
  }

  private handleYjsUpdate = (update: Uint8Array, origin: unknown): void => {
    // Ignore updates that originated from us (avoid echo)
    if (origin === this) return

    const payload = this.uint8ToBase64(update)
    const chunks = this.splitPayload(payload)

    // All chunks in a multi-chunk batch share the same prevEventId so the
    // receiver can reassemble them. For single-chunk updates prevEventId
    // is just the last known event id for causal ordering.
    const sharedPrevEventId = this.lastEventId

    for (let i = 0; i < chunks.length; i++) {
      const event: DocSyncEvent = {
        type: chunks.length === 1 ? 'full' : 'delta',
        docId: this.roomId,
        seq: i,
        total: chunks.length,
        payload: chunks[i],
        prevEventId: sharedPrevEventId,
      }

      // Cast through any because custom event types are not in TimelineEvents
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(this.client as any).sendEvent(this.roomId, MATRIX_EVENT_TYPES.DOC_SYNC, event)
        .then((res: { event_id: string }) => {
          if (i === chunks.length - 1) {
            this.lastEventId = res.event_id
          }
        })
        .catch(console.error)
    }
  }

  private handleTimelineEvent = (roomEvent: unknown): void => {
    const event = roomEvent as {
      event: {
        type: string
        content: DocSyncEvent
        room_id: string
        event_id: string
      }
    }
    if (event.event?.type !== MATRIX_EVENT_TYPES.DOC_SYNC) return
    if (event.event?.room_id !== this.roomId) return

    const content = event.event.content
    if (!content?.payload) return

    if (content.total > 1) {
      // Use prevEventId as the chunk-grouping key. All chunks from the
      // same batch share the same prevEventId; different batches have
      // different prevEventIds. Fall back to docId for the initial batch
      // where prevEventId is null.
      const batchKey = content.prevEventId ?? `${content.docId}--initial`

      if (!this.pendingChunks.has(batchKey)) {
        this.pendingChunks.set(batchKey, [])
      }
      const chunks = this.pendingChunks.get(batchKey)!
      chunks[content.seq] = this.base64ToUint8(content.payload)

      const allReceived = chunks.filter(Boolean).length === content.total
      if (allReceived) {
        const merged = this.mergeChunks(chunks)
        applyUpdate(this.doc, merged, this)
        this.pendingChunks.delete(batchKey)
      }
    } else {
      const update = this.base64ToUint8(content.payload)
      applyUpdate(this.doc, update, this)
    }

    this.lastEventId = event.event.event_id
  }

  sendSnapshot(): void {
    const snapshot = encodeStateAsUpdate(this.doc)
    const payload = this.uint8ToBase64(snapshot)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(this.client as any).sendEvent(this.roomId, MATRIX_EVENT_TYPES.DOC_SYNC, {
      type: 'full',
      docId: this.roomId,
      seq: 0,
      total: 1,
      payload,
      prevEventId: null,
    }).catch(console.error)
  }

  sendCursor(cursor: DocCursorEvent): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(this.client as any).sendEvent(this.roomId, MATRIX_EVENT_TYPES.DOC_CURSOR, cursor)
      .catch(() => {}) // Cursor events are ephemeral; silence errors
  }

  destroy(): void {
    this.doc.off('update', this.handleYjsUpdate)
    this.client.off(RoomEvent.Timeline, this.handleTimelineEvent)
  }

  // --- Private helpers ---

  private splitPayload(payload: string): string[] {
    if (payload.length <= MAX_CHUNK_SIZE) return [payload]
    const chunks: string[] = []
    for (let i = 0; i < payload.length; i += MAX_CHUNK_SIZE) {
      chunks.push(payload.slice(i, i + MAX_CHUNK_SIZE))
    }
    return chunks
  }

  private mergeChunks(chunks: Uint8Array[]): Uint8Array {
    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0)
    const merged = new Uint8Array(totalLen)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    return merged
  }

  private uint8ToBase64(uint8: Uint8Array): string {
    let binary = ''
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i])
    }
    return btoa(binary)
  }

  private base64ToUint8(base64: string): Uint8Array {
    const binary = atob(base64)
    const uint8 = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      uint8[i] = binary.charCodeAt(i)
    }
    return uint8
  }
}

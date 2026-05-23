import type { MatrixClient } from 'matrix-js-sdk'
import type { Doc } from 'yjs'
import type { DocCursorEvent, DocSyncEvent } from '../types/doc'
import type { DesktopEffect } from '@/shared/lib/effect'
import { getClient } from '@matrix/client'
import { Effect } from 'effect'
import { RoomEvent } from 'matrix-js-sdk'
import { applyUpdate, encodeStateAsUpdate } from 'yjs'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'
import { MATRIX_EVENT_TYPES } from '../types/doc'

const MAX_CHUNK_SIZE = 60 * 1024
interface MatrixSendEventResult {
  event_id: string
}
interface MatrixEventClient extends MatrixClient {
  sendEvent: (roomId: string, eventType: string, content: unknown) => Promise<MatrixSendEventResult>
}
interface MatrixDocRoom {
  getLiveTimeline?: () => {
    getEvents?: () => unknown[]
  }
}

interface MatrixDocEventLike {
  getType?: () => string
  getContent?: () => unknown
  getRoomId?: () => string | undefined
  getId?: () => string | undefined
  event?: {
    type?: string
    content?: unknown
    room_id?: string
    event_id?: string
  }
}

interface ExtractedDocSyncEvent {
  content: DocSyncEvent
  eventId: string
}

type DocCursorHandler = (cursor: DocCursorEvent) => void

function isDocSyncEventContent(value: unknown): value is DocSyncEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as DocSyncEvent).docId === 'string' &&
    typeof (value as DocSyncEvent).payload === 'string' &&
    typeof (value as DocSyncEvent).seq === 'number' &&
    typeof (value as DocSyncEvent).total === 'number'
  )
}

function isDocCursorEventContent(value: unknown): value is DocCursorEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as DocCursorEvent).userId === 'string' &&
    typeof (value as DocCursorEvent).name === 'string' &&
    typeof (value as DocCursorEvent).color === 'string' &&
    typeof (value as DocCursorEvent).from === 'number' &&
    typeof (value as DocCursorEvent).to === 'number'
  )
}

export class MatrixSyncProvider {
  private doc: Doc
  private roomId: string
  private client: MatrixClient
  private lastEventId: string | null = null
  private pendingChunks = new Map<string, Uint8Array[]>()
  private cursorHandlers = new Set<DocCursorHandler>()
  private batchCounter = 0

  constructor(doc: Doc, roomId: string, client?: MatrixClient) {
    this.doc = doc
    this.roomId = roomId
    this.client = client ?? getClient()

    this.applyStoredTimelineEvents()
    this.doc.on('update', this.handleYjsUpdate)
    this.client.on(RoomEvent.Timeline, this.handleTimelineEvent)
  }

  private handleYjsUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === this) return

    const payload = this.uint8ToBase64(update)
    const chunks = this.splitPayload(payload)
    const sharedPrevEventId = this.lastEventId
    const batchId = `${this.roomId}--${++this.batchCounter}`

    for (let i = 0; i < chunks.length; i++) {
      const event: DocSyncEvent = {
        type: chunks.length === 1 ? 'full' : 'delta',
        docId: this.roomId,
        seq: i,
        total: chunks.length,
        payload: chunks[i],
        prevEventId: sharedPrevEventId,
        batchId,
      }

      this.runBackgroundEffect(
        this.sendDocSyncEventEffect(event, i === chunks.length - 1),
        '[MatrixSyncProvider] Failed to send sync event:',
      )
    }
  }

  private handleTimelineEvent = (roomEvent: unknown): void => {
    const cursor = this.extractDocCursorEvent(roomEvent)
    if (cursor) {
      this.emitCursorEvent(cursor)
      return
    }

    const event = this.extractDocSyncEvent(roomEvent)
    if (!event) return

    this.applyDocSyncEvent(event)
  }

  sendSnapshot(): void {
    const snapshot = encodeStateAsUpdate(this.doc)
    const payload = this.uint8ToBase64(snapshot)

    this.runBackgroundEffect(
      this.sendDocSyncEventEffect(
        {
          type: 'full',
          docId: this.roomId,
          seq: 0,
          total: 1,
          payload,
          prevEventId: null,
          batchId: `${this.roomId}--snapshot-${Date.now()}`,
        },
        false,
      ),
      '[MatrixSyncProvider] Failed to send snapshot:',
    )
  }

  sendCursor(cursor: DocCursorEvent): void {
    this.runBackgroundEffect(this.sendCursorEffect(cursor), '[MatrixSyncProvider] Failed to send cursor:')
  }

  sendSnapshotEffect(): DesktopEffect<void> {
    const snapshot = encodeStateAsUpdate(this.doc)
    const payload = this.uint8ToBase64(snapshot)

    return this.sendDocSyncEventEffect(
      {
        type: 'full',
        docId: this.roomId,
        seq: 0,
        total: 1,
        payload,
        prevEventId: null,
        batchId: `${this.roomId}--snapshot-${Date.now()}`,
      },
      false,
    )
  }

  sendCursorEffect(cursor: DocCursorEvent): DesktopEffect<void> {
    return fromPromise(() =>
      (this.client as MatrixEventClient).sendEvent(this.roomId, MATRIX_EVENT_TYPES.DOC_CURSOR, cursor),
    ).pipe(
      Effect.asVoid,
      Effect.catchAll(() => fromSync(() => undefined)), // Cursor events are ephemeral; intentional noop.
    )
  }

  onCursor(handler: DocCursorHandler): () => void {
    this.cursorHandlers.add(handler)
    return () => {
      this.cursorHandlers.delete(handler)
    }
  }

  destroy(): void {
    this.doc.off('update', this.handleYjsUpdate)
    this.client.off(RoomEvent.Timeline, this.handleTimelineEvent)
    this.pendingChunks.clear()
    this.cursorHandlers.clear()
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

  private applyStoredTimelineEvents(): void {
    const room = this.client.getRoom?.(this.roomId) as MatrixDocRoom | null | undefined
    const events = room?.getLiveTimeline?.()?.getEvents?.() ?? []
    for (const event of events) {
      const syncEvent = this.extractDocSyncEvent(event)
      if (syncEvent) this.applyDocSyncEvent(syncEvent)
    }
  }

  private extractDocCursorEvent(roomEvent: unknown): DocCursorEvent | null {
    const event = roomEvent as MatrixDocEventLike
    const eventType = event.getType?.() ?? event.event?.type
    if (eventType !== MATRIX_EVENT_TYPES.DOC_CURSOR) return null

    const eventRoomId = event.getRoomId?.() ?? event.event?.room_id
    if (eventRoomId && eventRoomId !== this.roomId) return null

    const content = event.getContent?.() ?? event.event?.content
    if (!isDocCursorEventContent(content)) return null

    return content
  }

  private emitCursorEvent(cursor: DocCursorEvent): void {
    this.cursorHandlers.forEach((handler) => {
      handler(cursor)
    })
  }

  private extractDocSyncEvent(roomEvent: unknown): ExtractedDocSyncEvent | null {
    const event = roomEvent as MatrixDocEventLike
    const eventType = event.getType?.() ?? event.event?.type
    if (eventType !== MATRIX_EVENT_TYPES.DOC_SYNC) return null

    const eventRoomId = event.getRoomId?.() ?? event.event?.room_id
    if (eventRoomId && eventRoomId !== this.roomId) return null

    const content = event.getContent?.() ?? event.event?.content
    if (!isDocSyncEventContent(content)) return null
    if (content.docId !== this.roomId) return null

    return {
      content,
      eventId: event.getId?.() ?? event.event?.event_id ?? `${content.batchId}:${content.seq}`,
    }
  }

  private sendDocSyncEventEffect(event: DocSyncEvent, updateLastEventId: boolean): DesktopEffect<void> {
    return fromPromise(() =>
      (this.client as MatrixEventClient).sendEvent(this.roomId, MATRIX_EVENT_TYPES.DOC_SYNC, event),
    ).pipe(
      Effect.flatMap((res) =>
        updateLastEventId
          ? fromSync(() => {
              this.lastEventId = res.event_id
            })
          : Effect.succeed(undefined),
      ),
    )
  }

  private runBackgroundEffect(effect: DesktopEffect<void>, errorMessage: string): void {
    void runDesktopEffect(effect.pipe(Effect.catchAll((err) => fromSync(() => console.error(errorMessage, err)))))
  }

  private applyDocSyncEvent(event: ExtractedDocSyncEvent): void {
    runDesktopSync(
      this.applyDocSyncEventEffect(event).pipe(
        Effect.catchAll((err) =>
          fromSync(() => console.error('[MatrixSyncProvider] Failed to apply remote update:', err)),
        ),
      ),
    )
  }

  private applyDocSyncEventEffect(event: ExtractedDocSyncEvent): DesktopEffect<void> {
    const { content, eventId } = event

    return fromSync(() => {
      if (content.total > 1) {
        const batchKey = content.batchId || `${content.docId}:${content.prevEventId ?? eventId}:${content.total}`

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

      this.lastEventId = eventId
    })
  }
}

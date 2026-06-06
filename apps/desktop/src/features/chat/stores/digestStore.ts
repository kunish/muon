import type { MatrixEvent } from 'matrix-js-sdk'
import type { DigestFilter, DigestSourceEvent } from '../types/digest'
import { Store } from '@tanstack/vue-store'
import { matrixEvents } from '@/matrix/events'

export interface DigestClientState {
  /** Ephemeral live messages accumulated for the next away-window materialization. Never persisted. */
  sourceEvents: DigestSourceEvent[]
  activeFilter: DigestFilter
}

function createInitialState(): DigestClientState {
  return { sourceEvents: [], activeFilter: 'all' }
}

export const digestStore = new Store<DigestClientState>(createInitialState())

export function ingestEvent(event: DigestSourceEvent) {
  digestStore.setState((prev) => {
    const existingIndex = prev.sourceEvents.findIndex((sourceEvent) => sourceEvent.eventId === event.eventId)
    if (existingIndex >= 0) {
      const next = [...prev.sourceEvents]
      next[existingIndex] = event
      return { ...prev, sourceEvents: next }
    }
    return { ...prev, sourceEvents: [...prev.sourceEvents, event] }
  })
}

export function setFilter(nextFilter: DigestFilter) {
  digestStore.setState((prev) => ({ ...prev, activeFilter: nextFilter }))
}

// Module-level singleton subscription so a remounting panel reuses one handler,
// matching the old Pinia store's single `room.message` listener.
let runtimeHandler: ((payload: { roomId: string; event: MatrixEvent }) => void) | null = null

export function startRuntimeSync() {
  if (runtimeHandler) return

  runtimeHandler = ({ roomId, event }) => {
    const eventId = event?.getId?.()
    const ts = event?.getTs?.()
    const sender = event?.getSender?.()
    const body = event?.getContent?.()?.body

    if (!eventId || typeof ts !== 'number' || !sender || typeof body !== 'string' || body.length === 0) return

    ingestEvent({ roomId, eventId, sender, body, ts })
  }

  matrixEvents.on('room.message', runtimeHandler)
}

export function stopRuntimeSync() {
  if (!runtimeHandler) return

  matrixEvents.off('room.message', runtimeHandler)
  runtimeHandler = null
}

export function resetDigestStore() {
  stopRuntimeSync()
  digestStore.setState(() => createInitialState())
}

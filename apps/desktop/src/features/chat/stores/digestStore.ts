import type { MatrixEvent } from 'matrix-js-sdk'
import type { DigestFilter, DigestSession, DigestSourceEvent } from '../types/digest'
import type { DigestEntry } from '../types/knowledge'
import type { DesktopEffect } from '@/shared/lib/effect'
import { createKnowledgeRepository } from '@features/chat/lib/knowledgeDb'
import { Effect } from 'effect'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { materializeOfflineDigest } from '@/matrix/digest'
import { matrixEvents } from '@/matrix/events'
import { useNetworkStatus } from '@/shared/composables/useNetworkStatus'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { compareDigestEntries } from '../types/digest'

const repository = createKnowledgeRepository()

export const useDigestStore = defineStore('digest', () => {
  const { lastOfflineAt } = useNetworkStatus()

  const sourceEvents = shallowRef<DigestSourceEvent[]>([])
  const entries = ref<DigestEntry[]>([])
  const session = ref<DigestSession | null>(null)
  const activeFilter = ref<DigestFilter>('all')
  const loading = ref(false)
  let runtimeHandler: ((payload: { roomId: string; event: MatrixEvent }) => void) | null = null

  const visibleEntries = computed(() => {
    const filtered =
      activeFilter.value === 'all'
        ? entries.value
        : entries.value.filter((entry) => entry.relevance === activeFilter.value)

    return [...filtered].sort(compareDigestEntries).map((entry) => {
      const citation = entry.citations[0]
      return {
        ...entry,
        eventId: citation?.eventId ?? entry.id,
      }
    })
  })

  function ingestEvent(event: DigestSourceEvent) {
    const current = sourceEvents.value
    const existingIndex = current.findIndex((sourceEvent) => sourceEvent.eventId === event.eventId)
    if (existingIndex >= 0) {
      const next = [...current]
      next[existingIndex] = event
      sourceEvents.value = next
      return
    }

    sourceEvents.value = [...current, event]
  }

  function setFilter(nextFilter: DigestFilter) {
    activeFilter.value = nextFilter
  }

  function hydrateDigestEntriesEffect(): DesktopEffect<DigestEntry[]> {
    return Effect.gen(function* () {
      const savedEntries = yield* fromPromise(() => repository.listDigestEntries())
      entries.value = [...savedEntries].sort(compareDigestEntries)
      session.value = null
      return entries.value
    })
  }

  function hydrateDigestEntries() {
    return runDesktopEffect(hydrateDigestEntriesEffect())
  }

  function startRuntimeSync() {
    if (runtimeHandler) return

    runtimeHandler = ({ roomId, event }) => {
      const eventId = event?.getId?.()
      const ts = event?.getTs?.()
      const sender = event?.getSender?.()
      const body = event?.getContent?.()?.body

      if (!eventId || typeof ts !== 'number' || !sender || typeof body !== 'string' || body.length === 0) return

      ingestEvent({
        roomId,
        eventId,
        sender,
        body,
        ts,
      })
    }

    matrixEvents.on('room.message', runtimeHandler)
  }

  function stopRuntimeSync() {
    if (!runtimeHandler) return

    matrixEvents.off('room.message', runtimeHandler)
    runtimeHandler = null
  }

  function initializeDigestEffect(
    options: { now?: number; lastOfflineAt?: number | null } = {},
  ): DesktopEffect<DigestEntry[]> {
    return Effect.gen(function* () {
      yield* hydrateDigestEntriesEffect()
      yield* fromSync(() => startRuntimeSync())

      const windowStart = options.lastOfflineAt ?? lastOfflineAt.value
      if (windowStart == null) return entries.value

      return yield* buildDigestSessionEffect(options)
    })
  }

  function initializeDigest(options: { now?: number; lastOfflineAt?: number | null } = {}) {
    return runDesktopEffect(initializeDigestEffect(options))
  }

  function buildDigestSessionEffect(
    options: { now?: number; lastOfflineAt?: number | null } = {},
  ): DesktopEffect<DigestEntry[]> {
    return Effect.gen(function* () {
      const windowStart = options.lastOfflineAt ?? lastOfflineAt.value
      const windowEnd = options.now ?? Date.now()
      if (windowStart == null) {
        entries.value = []
        session.value = null
        return []
      }

      loading.value = true
      const nextSession = materializeOfflineDigest(sourceEvents.value, {
        sessionId: `digest-session:${windowStart}:${windowEnd}`,
        windowStart,
        windowEnd,
      })

      session.value = nextSession

      if (nextSession.entries.length === 0 && entries.value.length > 0) {
        // Preserve hydrated entries; do not overwrite with empty materialization
        return entries.value
      }

      entries.value = nextSession.entries
      yield* fromPromise(() => Promise.all(nextSession.entries.map((entry) => repository.saveDigestEntry(entry))))
      return nextSession.entries
    }).pipe(Effect.ensuring(Effect.sync(() => void (loading.value = false))))
  }

  function buildDigestSession(options: { now?: number; lastOfflineAt?: number | null } = {}) {
    return runDesktopEffect(buildDigestSessionEffect(options))
  }

  return {
    activeFilter,
    entries,
    loading,
    session,
    sourceEvents,
    visibleEntries,
    hydrateDigestEntriesEffect,
    initializeDigestEffect,
    buildDigestSessionEffect,
    hydrateDigestEntries,
    initializeDigest,
    ingestEvent,
    startRuntimeSync,
    stopRuntimeSync,
    setFilter,
    buildDigestSession,
  }
})

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useNetworkStatus } from '@/shared/composables/useNetworkStatus'
import { createKnowledgeRepository } from '@/shared/lib/knowledgeDb'
import { materializeOfflineDigest } from '@/matrix/digest'
import { matrixEvents } from '@/matrix/events'
import type { DigestEntry } from '../types/knowledge'
import type { DigestFilter, DigestSession, DigestSourceEvent } from '../types/digest'
import { compareDigestEntries } from '../types/digest'

const repository = createKnowledgeRepository()

export const useDigestStore = defineStore('digest', () => {
  const { lastOfflineAt } = useNetworkStatus()

  const sourceEvents = ref<DigestSourceEvent[]>([])
  const entries = ref<DigestEntry[]>([])
  const session = ref<DigestSession | null>(null)
  const activeFilter = ref<DigestFilter>('all')
  const loading = ref(false)
  let runtimeHandler: ((payload: { roomId: string, event: any }) => void) | null = null

  const visibleEntries = computed(() => {
    const filtered = activeFilter.value === 'all'
      ? entries.value
      : entries.value.filter(entry => entry.relevance === activeFilter.value)

    return [...filtered].sort(compareDigestEntries).map((entry) => {
      const citation = entry.citations[0]
      return {
        ...entry,
        eventId: citation?.eventId ?? entry.id,
      }
    })
  })

  function ingestEvent(event: DigestSourceEvent) {
    const existingIndex = sourceEvents.value.findIndex(sourceEvent => sourceEvent.eventId === event.eventId)
    if (existingIndex >= 0) {
      sourceEvents.value.splice(existingIndex, 1, event)
      return
    }

    sourceEvents.value.push(event)
  }

  function setFilter(nextFilter: DigestFilter) {
    activeFilter.value = nextFilter
  }

  async function hydrateDigestEntries() {
    const savedEntries = await repository.listDigestEntries()
    entries.value = [...savedEntries].sort(compareDigestEntries)
    session.value = null
    return entries.value
  }

  function startRuntimeSync() {
    if (runtimeHandler)
      return

    runtimeHandler = ({ roomId, event }) => {
      const eventId = event?.getId?.()
      const ts = event?.getTs?.()
      const sender = event?.getSender?.()
      const body = event?.getContent?.()?.body

      if (!eventId || typeof ts !== 'number' || !sender || typeof body !== 'string' || body.length === 0)
        return

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
    if (!runtimeHandler)
      return

    matrixEvents.off('room.message', runtimeHandler)
    runtimeHandler = null
  }

  async function initializeDigest(options: { now?: number, lastOfflineAt?: number | null } = {}) {
    await hydrateDigestEntries()
    startRuntimeSync()

    const windowStart = options.lastOfflineAt ?? lastOfflineAt.value
    if (windowStart == null)
      return entries.value

    return await buildDigestSession(options)
  }

  async function buildDigestSession(options: { now?: number, lastOfflineAt?: number | null } = {}) {
    const windowStart = options.lastOfflineAt ?? lastOfflineAt.value
    const windowEnd = options.now ?? Date.now()
    if (windowStart == null) {
      entries.value = []
      session.value = null
      return []
    }

    loading.value = true
    try {
      const nextSession = materializeOfflineDigest(sourceEvents.value, {
        sessionId: `digest-session:${windowStart}:${windowEnd}`,
        windowStart,
        windowEnd,
      })

      session.value = nextSession
      entries.value = nextSession.entries

      await Promise.all(nextSession.entries.map(entry => repository.saveDigestEntry(entry)))
      return nextSession.entries
    }
    finally {
      loading.value = false
    }
  }

  return {
    activeFilter,
    entries,
    loading,
    session,
    sourceEvents,
    visibleEntries,
    hydrateDigestEntries,
    initializeDigest,
    ingestEvent,
    startRuntimeSync,
    stopRuntimeSync,
    setFilter,
    buildDigestSession,
  }
})

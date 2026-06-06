import type { Component } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OfflineDigestPanel from '@/features/chat/components/OfflineDigestPanel.vue'
import { digestStore, ingestEvent, resetDigestStore } from '@/features/chat/stores/digestStore'
import { createTestQueryClient } from '../helpers/queryClient'

const routerPush = vi.fn()
const loadInboxEventContextMock = vi.fn()
const listDigestEntriesMock = vi.fn()
const saveDigestEntryMock = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}))

vi.mock('@/shared/composables/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    status: { value: 'online' },
    lastOfflineAt: { value: 100 },
  }),
}))

vi.mock('@features/chat/lib/knowledgeDb', () => ({
  createKnowledgeRepository: () => ({
    listDigestEntries: (...args: unknown[]) => listDigestEntriesMock(...args),
    saveDigestEntry: (...args: unknown[]) => saveDigestEntryMock(...args),
  }),
}))

vi.mock('@/matrix/events', () => ({
  matrixEvents: {
    on: vi.fn(),
    off: vi.fn(),
  },
}))

vi.mock('@/matrix/rooms', () => ({
  getRoomSummaries: () => [],
}))

vi.mock('@/matrix/client', () => ({
  getClient: () => ({
    getUserId: () => '@me:muon.dev',
  }),
}))

vi.mock('@matrix/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@matrix/index')>()
  return {
    ...actual,
    loadInboxEventContext: (...args: unknown[]) => loadInboxEventContextMock(...args),
  }
})

function digestEntry(id: string, relevance: string, createdAt: number) {
  return {
    id: `digest:${id}`,
    sessionId: 'digest-session:test',
    title: `Title ${id}`,
    summary: `Summary ${id}`,
    relevance,
    citations: [{ roomId: '!room:muon.dev', eventId: `$${id}`, quote: `Summary ${id}` }],
    citationEventIds: [`$${id}`],
    createdAt,
    updatedAt: createdAt,
  }
}

function mountWithQuery(component: Component) {
  const queryClient = createTestQueryClient()
  const wrapper = mount(component, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  return { wrapper, queryClient }
}

describe('offlineDigestPanel', () => {
  beforeEach(() => {
    resetDigestStore()
    routerPush.mockReset()
    loadInboxEventContextMock.mockReset()
    listDigestEntriesMock.mockReset()
    saveDigestEntryMock.mockReset()

    listDigestEntriesMock.mockResolvedValue([])
    saveDigestEntryMock.mockResolvedValue(undefined)
  })

  it('hydrates persisted entries on mount and preserves them when there are no live events', async () => {
    listDigestEntriesMock.mockResolvedValue([
      digestEntry('persisted-a', 'responsibility', 150),
      digestEntry('persisted-b', 'follow', 160),
    ])

    const { wrapper } = mountWithQuery(OfflineDigestPanel)
    await flushPromises()

    expect(wrapper.findAll('article')).toHaveLength(2)
    expect(wrapper.text()).toContain('Title persisted-a')
    expect(wrapper.text()).toContain('Title persisted-b')
    // Empty materialization must not overwrite the hydrated entries (no re-persist).
    expect(saveDigestEntryMock).not.toHaveBeenCalled()
  })

  it('builds an away-window session from ingested source events and persists it', async () => {
    // Nothing persisted yet; a live message arrived inside the away window.
    ingestEvent({ roomId: '!ops:muon.dev', eventId: '$live', sender: '@alice:muon.dev', body: 'Live update', ts: 150 })

    const { wrapper, queryClient } = mountWithQuery(OfflineDigestPanel)
    await flushPromises()

    expect(wrapper.text()).toContain('Live update')
    expect(wrapper.get('[data-testid="digest-entry-$live"]')).toBeTruthy()
    expect(saveDigestEntryMock).toHaveBeenCalledTimes(1)
    expect(queryClient.getQueryData<Array<{ id: string }>>(['digest', 'entries'])).toHaveLength(1)
  })

  it('logs and keeps the panel usable when hydration fails, without attempting a build', async () => {
    listDigestEntriesMock.mockRejectedValue(new Error('dexie offline'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { wrapper } = mountWithQuery(OfflineDigestPanel)
    await flushPromises()

    expect(wrapper.findAll('article')).toHaveLength(0)
    expect(wrapper.text()).toContain('暂无离线摘要')
    // A failed hydrate must short-circuit before the away-window build runs.
    expect(saveDigestEntryMock).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith('[OfflineDigestPanel] failed to hydrate digest entries', expect.any(Error))
    errorSpy.mockRestore()
  })

  it('logs and does not crash when persisting a built session fails', async () => {
    ingestEvent({ roomId: '!ops:muon.dev', eventId: '$live', sender: '@alice:muon.dev', body: 'Live update', ts: 150 })
    saveDigestEntryMock.mockRejectedValue(new Error('quota exceeded'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { wrapper } = mountWithQuery(OfflineDigestPanel)
    await flushPromises()

    expect(saveDigestEntryMock).toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith(
      '[OfflineDigestPanel] failed to build offline digest session',
      expect.any(Error),
    )
    // Build failure leaves the cache unwritten; the panel still renders (empty here).
    expect(wrapper.get('[data-testid="offline-digest-panel"]')).toBeTruthy()
    errorSpy.mockRestore()
  })

  it('uses localized labels for filters and empty state', async () => {
    const { wrapper } = mountWithQuery(OfflineDigestPanel)
    await flushPromises()

    expect(wrapper.text()).toContain('离线摘要')
    expect(wrapper.text()).toContain('全部')
    expect(wrapper.text()).toContain('责任')
    expect(wrapper.text()).toContain('跟进')
    expect(wrapper.text()).toContain('提及')
    expect(wrapper.text()).toContain('暂无离线摘要')
    expect(wrapper.text()).not.toContain('Offline Digest')
    expect(wrapper.text()).not.toContain('No digest entries yet')
  })

  it('clicking a citation preloads context before focusEventId navigation', async () => {
    listDigestEntriesMock.mockResolvedValue([digestEntry('event-1', 'responsibility', 150)])
    loadInboxEventContextMock.mockResolvedValue({})

    const { wrapper } = mountWithQuery(OfflineDigestPanel)
    await flushPromises()

    await wrapper.get('[data-testid="digest-citation-$event-1"]').trigger('click')

    expect(loadInboxEventContextMock).toHaveBeenCalledWith('!room:muon.dev', '$event-1')
    expect(routerPush).toHaveBeenCalledWith({
      path: '/dm/!room%3Amuon.dev',
      query: { focusEventId: '$event-1' },
    })
  })

  it('remounting the panel after unmount shows the previously persisted entries', async () => {
    const persisted = [digestEntry('persisted-a', 'responsibility', 150), digestEntry('persisted-b', 'follow', 160)]
    listDigestEntriesMock.mockResolvedValue(persisted)

    const first = mountWithQuery(OfflineDigestPanel)
    await flushPromises()
    expect(first.wrapper.findAll('article')).toHaveLength(2)
    first.wrapper.unmount()

    // sourceEvents is empty after remount, so hydration restores the persisted entries.
    const second = mountWithQuery(OfflineDigestPanel)
    await flushPromises()

    expect(second.wrapper.findAll('article')).toHaveLength(2)
    expect(second.wrapper.text()).toContain('Title persisted-a')
    expect(second.wrapper.text()).toContain('Title persisted-b')
  })

  it('preload failure only warns and still navigates', async () => {
    listDigestEntriesMock.mockResolvedValue([digestEntry('event-1', 'responsibility', 150)])
    loadInboxEventContextMock.mockRejectedValue(new Error('network error'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { wrapper } = mountWithQuery(OfflineDigestPanel)
    await flushPromises()

    await wrapper.get('[data-testid="digest-citation-$event-1"]').trigger('click')

    expect(warnSpy).toHaveBeenCalled()
    expect(routerPush).toHaveBeenCalledWith({
      path: '/dm/!room%3Amuon.dev',
      query: { focusEventId: '$event-1' },
    })
    warnSpy.mockRestore()
  })

  it('does not retain ingested source events across resetDigestStore', () => {
    ingestEvent({ roomId: '!ops:muon.dev', eventId: '$live', sender: '@alice:muon.dev', body: 'Live update', ts: 150 })
    expect(digestStore.state.sourceEvents).toHaveLength(1)

    resetDigestStore()

    expect(digestStore.state.sourceEvents).toEqual([])
  })
})

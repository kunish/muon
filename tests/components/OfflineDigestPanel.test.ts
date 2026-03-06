import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OfflineDigestPanel from '@/features/chat/components/OfflineDigestPanel.vue'
import { useDigestStore } from '@/features/chat/stores/digestStore'

const routerPush = vi.fn()
const loadInboxEventContextMock = vi.fn()
const listDigestEntriesMock = vi.fn()
const saveDigestEntryMock = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/shared/composables/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    status: { value: 'online' },
    lastOfflineAt: { value: 100 },
  }),
}))

vi.mock('@/shared/lib/knowledgeDb', () => ({
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

describe('OfflineDigestPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    routerPush.mockReset()
    loadInboxEventContextMock.mockReset()
    listDigestEntriesMock.mockReset()
    saveDigestEntryMock.mockReset()

    listDigestEntriesMock.mockResolvedValue([])
    saveDigestEntryMock.mockResolvedValue(undefined)
  })

  it('initializes digest on mount so saved entries restore before refresh', async () => {
    const store = useDigestStore()
    const initializeSpy = vi.spyOn(store, 'initializeDigest')

    mount(OfflineDigestPanel)
    await flushPromises()

    expect(initializeSpy).toHaveBeenCalledTimes(1)
  })

  it('clicking citation preloads context before focusEventId navigation', async () => {
    const store = useDigestStore()
    store.entries = [
      {
        id: 'digest:$event-1',
        sessionId: 'digest-session:test',
        title: 'Digest body',
        summary: 'Digest body',
        relevance: 'responsibility',
        citations: [{ roomId: '!room:muon.dev', eventId: '$event-1', quote: 'Digest body' }],
        citationEventIds: ['$event-1'],
        createdAt: 150,
        updatedAt: 150,
      },
    ]
    loadInboxEventContextMock.mockResolvedValue({})

    const wrapper = mount(OfflineDigestPanel)
    await wrapper.find('[data-testid="digest-citation-$event-1"]').trigger('click')

    expect(loadInboxEventContextMock).toHaveBeenCalledWith('!room:muon.dev', '$event-1')
    expect(routerPush).toHaveBeenCalledWith({
      path: '/dm/!room%3Amuon.dev',
      query: { focusEventId: '$event-1' },
    })
  })

  it('preload failure only warns and still navigates', async () => {
    const store = useDigestStore()
    store.entries = [
      {
        id: 'digest:$event-1',
        sessionId: 'digest-session:test',
        title: 'Digest body',
        summary: 'Digest body',
        relevance: 'responsibility',
        citations: [{ roomId: '!room:muon.dev', eventId: '$event-1', quote: 'Digest body' }],
        citationEventIds: ['$event-1'],
        createdAt: 150,
        updatedAt: 150,
      },
    ]
    loadInboxEventContextMock.mockRejectedValue(new Error('network error'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const wrapper = mount(OfflineDigestPanel)
    await wrapper.find('[data-testid="digest-citation-$event-1"]').trigger('click')

    expect(warnSpy).toHaveBeenCalled()
    expect(routerPush).toHaveBeenCalledWith({
      path: '/dm/!room%3Amuon.dev',
      query: { focusEventId: '$event-1' },
    })
    warnSpy.mockRestore()
  })
})

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OfflineDigestPanel from '@/features/chat/components/OfflineDigestPanel.vue'
import { useDigestStore } from '@/features/chat/stores/digestStore'

const routerPush = vi.fn()
const loadInboxEventContextMock = vi.fn()

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
    saveDigestEntry: vi.fn().mockResolvedValue(undefined),
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
  })

  it('renders digest entries after session build', async () => {
    const store = useDigestStore()
    store.ingestEvent({
      roomId: '!room:muon.dev',
      eventId: '$event-1',
      sender: '@alice:muon.dev',
      body: 'Digest body',
      ts: 150,
      relevanceHint: 'responsibility',
    })
    await store.buildDigestSession({ now: 200 })

    const wrapper = mount(OfflineDigestPanel)

    expect(wrapper.find('[data-testid="digest-entry-$event-1"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Digest body')
  })

  it('clicking citation preloads context before focusEventId navigation', async () => {
    const store = useDigestStore()
    store.ingestEvent({
      roomId: '!room:muon.dev',
      eventId: '$event-1',
      sender: '@alice:muon.dev',
      body: 'Digest body',
      ts: 150,
      relevanceHint: 'responsibility',
    })
    await store.buildDigestSession({ now: 200 })
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
    store.ingestEvent({
      roomId: '!room:muon.dev',
      eventId: '$event-1',
      sender: '@alice:muon.dev',
      body: 'Digest body',
      ts: 150,
      relevanceHint: 'responsibility',
    })
    await store.buildDigestSession({ now: 200 })
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

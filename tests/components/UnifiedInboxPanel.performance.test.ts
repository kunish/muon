import type { UnifiedInboxItem } from '@/features/chat/types/unifiedInbox'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import UnifiedInboxPanel from '@/features/chat/components/UnifiedInboxPanel.vue'

const inboxItems = ref<UnifiedInboxItem[]>([])

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/features/chat/composables/useUnifiedInbox', () => ({
  useUnifiedInbox: () => ({
    items: computed(() => inboxItems.value),
    counts: computed(() => ({
      'all': inboxItems.value.length,
      'mention': inboxItems.value.filter(item => item.type === 'mention').length,
      'priority-unread': inboxItems.value.filter(item => item.type === 'priority-unread').length,
      'reply-needed': inboxItems.value.filter(item => item.type === 'reply-needed').length,
    })),
    isLoading: ref(false),
  }),
  __resetUnifiedInboxForTests: () => {
    inboxItems.value = []
  },
}))

function createInboxItem(index: number): UnifiedInboxItem {
  return {
    id: `mention:room-${index}`,
    roomId: `!room-${index}:muon.dev`,
    roomName: `Room ${index}`,
    eventId: `$event-${index}`,
    createdTs: 1_700_000_000_000 + index,
    snippet: `Snippet ${index}`,
    unreadCount: 1,
    highlightCount: 1,
    type: 'mention',
  }
}

describe('unifiedInboxPanel performance', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    inboxItems.value = Array.from({ length: 200 }, (_, index) => createInboxItem(index))
  })

  it('renders only a bounded window of inbox rows for large datasets', async () => {
    const wrapper = mount(UnifiedInboxPanel)

    const renderedRows = wrapper.findAll('[data-testid^="inbox-jump-"]')

    expect(renderedRows.length).toBeLessThan(40)
    expect(renderedRows.length).toBeGreaterThan(0)
    expect(renderedRows.length).toBeLessThan(inboxItems.value.length)
  })
})

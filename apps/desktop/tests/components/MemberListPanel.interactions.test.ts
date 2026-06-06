import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MemberListPanel from '@/features/chat/components/MemberListPanel.vue'
import { resetChatStore, setCurrentRoom } from '@/features/chat/stores/chatStore'

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock('@/shared/composables/useAuthMedia', () => ({
  useAuthMedia: () => '',
}))

function mountMemberListPanel() {
  return mount(MemberListPanel, {
    global: {
      stubs: {
        Avatar: true,
        Teleport: true,
        Transition: false,
      },
    },
  })
}

describe('member list panel interactions', () => {
  beforeEach(() => {
    resetChatStore()
    setCurrentRoom('!group_project:localhost')
  })

  it('opens a profile card when selecting a room member', async () => {
    const wrapper = mountMemberListPanel()

    await wrapper.get('[data-testid="chat-member-row-@alice:localhost"]').trigger('click')

    expect(wrapper.text()).toContain('@alice:localhost')
    expect(wrapper.find('[data-testid="user-info-send-message"]').exists()).toBe(true)
  })
})

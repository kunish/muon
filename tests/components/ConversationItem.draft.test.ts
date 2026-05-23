import type { RoomSummary } from '@matrix/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ConversationItem from '@/features/chat/components/ConversationItem.vue'
import { useChatStore } from '@/features/chat/stores/chatStore'

function createRoom(overrides: Partial<RoomSummary> = {}): RoomSummary {
  return {
    roomId: '!room:localhost',
    name: 'Room',
    lastMessage: 'Last message',
    lastMessageTs: 1,
    unreadCount: 0,
    isDirect: false,
    isEncrypted: false,
    members: [],
    isPinned: false,
    isMuted: false,
    highlightCount: 0,
    memberCount: 2,
    ...overrides,
  }
}

describe('ConversationItem draft preview', () => {
  it('shows media-only draft previews in the sidebar', () => {
    const store = useChatStore()
    ;(store as any).setDraftPreview('!room:localhost', 'draft.png')

    const wrapper = mount(ConversationItem, {
      props: {
        room: createRoom(),
        active: false,
      },
    })

    expect(wrapper.text()).toContain('草稿')
    expect(wrapper.text()).toContain('draft.png')
    expect(wrapper.text()).not.toContain('Last message')
  })
})

import type { SpaceMember } from '@/matrix/spaces'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useChatStore } from '@/features/chat/stores/chatStore'
import MemberPanel from '@/features/server/components/MemberPanel.vue'
import { useServerStore } from '@/features/server/stores/serverStore'

const memberPanelMocks = vi.hoisted(() => ({
  members: [] as SpaceMember[],
}))

vi.mock('@/matrix/spaces', () => ({
  getSpaceMembers: () => memberPanelMocks.members,
}))

vi.mock('@/matrix/profile', () => ({
  getUserPresenceInfo: () => ({ presence: 'offline' }),
}))

function mountMemberPanel(members: SpaceMember[]) {
  const pinia = createPinia()
  setActivePinia(pinia)
  memberPanelMocks.members = members

  const serverStore = useServerStore()
  serverStore.currentServerId = '!server:localhost'

  return mount(MemberPanel, {
    props: {
      visible: true,
    },
    global: {
      plugins: [pinia],
      stubs: {
        MemberContextMenu: defineComponent({
          name: 'MemberContextMenu',
          emits: ['mention'],
          setup(_, { emit }) {
            return () => h('button', {
              'data-testid': 'member-context-mention',
              'onClick': () => emit('mention', '@alice:localhost'),
            })
          },
        }),
        MemberItem: defineComponent({
          name: 'MemberItem',
          props: {
            member: {
              type: Object,
              required: true,
            },
          },
          setup(props) {
            return () => h('div', props.member.displayName)
          },
        }),
        Transition: false,
      },
    },
  })
}

describe('memberPanel localization', () => {
  beforeEach(() => {
    memberPanelMocks.members = []
  })

  it('uses Chinese labels for search and role sections', () => {
    const wrapper = mountMemberPanel([
      {
        userId: '@alice:localhost',
        displayName: 'Alice',
        powerLevel: 0,
        membership: 'join',
      },
    ])

    expect(wrapper.get('input').attributes('placeholder')).toBe('搜索成员')
    expect(wrapper.text()).toContain('成员 — 1')
    expect(wrapper.text()).not.toContain('MEMBER')
    expect(wrapper.text()).not.toContain('Members')
  })

  it('uses Chinese empty states for no members and no matches', async () => {
    const wrapper = mountMemberPanel([])

    expect(wrapper.text()).toContain('暂无成员')
    expect(wrapper.text()).not.toContain('No members')

    memberPanelMocks.members = [{
      userId: '@alice:localhost',
      displayName: 'Alice',
      powerLevel: 0,
      membership: 'join',
    }]
    const matchingWrapper = mountMemberPanel(memberPanelMocks.members)
    await matchingWrapper.get('input').setValue('nobody')

    expect(matchingWrapper.text()).toContain('没有匹配的成员')
    expect(matchingWrapper.text()).not.toContain('No matching members')
  })

  it('queues context-menu mentions for the current composer', async () => {
    const wrapper = mountMemberPanel([
      {
        userId: '@alice:localhost',
        displayName: 'Alice',
        powerLevel: 0,
        membership: 'join',
      },
    ])

    await wrapper.get('[data-testid="member-context-mention"]').trigger('click')

    expect((useChatStore() as any).pendingMentionRequests).toEqual([
      { id: '@alice:localhost', label: 'Alice' },
    ])
  })
})

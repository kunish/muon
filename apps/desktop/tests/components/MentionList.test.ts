import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MentionList from '@/features/chat/components/MentionList.vue'

vi.mock('@matrix/media', () => ({
  fetchMediaBlobUrl: vi.fn().mockResolvedValue(''),
}))

describe('mention list', () => {
  it('dims contacts that are not in the current room context', () => {
    const wrapper = mount(MentionList, {
      props: {
        selectedIndex: 0,
        items: [
          {
            id: '@alice:localhost',
            label: '小红',
            isInCurrentRoom: true,
          },
          {
            id: '@edward:localhost',
            label: '小伟',
            isInCurrentRoom: false,
          },
        ],
      },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons[0].classes()).not.toContain('opacity-50')
    expect(buttons[1].classes()).toContain('opacity-50')
  })
})

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WorkspaceLayout from '@/app/components/workspace/WorkspaceLayout.vue'

describe('chat history scroll layout', () => {
  it('constrains routed content so the chat message list owns vertical scrolling', () => {
    const wrapper = mount(WorkspaceLayout, {
      global: {
        stubs: {
          WorkspaceAppRail: true,
        },
      },
      slots: {
        default: '<div data-testid="routed-chat" class="h-full">chat</div>',
      },
    })

    const main = wrapper.find('main')

    expect(main.classes()).toEqual(expect.arrayContaining(['flex', 'h-full', 'min-h-0', 'overflow-hidden']))
  })
})

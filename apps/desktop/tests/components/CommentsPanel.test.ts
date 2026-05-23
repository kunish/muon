import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CommentsPanel from '@/features/docs/components/collaboration/CommentsPanel.vue'

describe('commentsPanel', () => {
  it('distinguishes anchored selection comments from whole-document comments', () => {
    const wrapper = mount(CommentsPanel, {
      props: {
        draftText: '',
        comments: [
          {
            id: 'selection-comment',
            userId: '@alice:localhost',
            text: '这里需要补充',
            selection: { from: 4, to: 12 },
            resolved: false,
            createdAt: 1,
          },
          {
            id: 'whole-doc-comment',
            userId: '@bob:localhost',
            text: '整体结构不错',
            selection: null,
            resolved: false,
            createdAt: 2,
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('选区评论 4-12')
    expect(wrapper.text()).toContain('全文评论')
  })
})

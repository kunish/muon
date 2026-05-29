import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReplyReference from '@/features/chat/components/ReplyReference.vue'

function mountReply() {
  return mount(ReplyReference, {
    props: {
      replySenderName: 'Alice',
      replyBody: 'original message',
      replySender: '@alice:localhost',
      replySenderMxcAvatar: undefined,
      isRightAligned: false,
    },
    global: { stubs: { Avatar: true } },
  })
}

describe('replyReference', () => {
  it('emits jump when the quoted reference is clicked', async () => {
    const wrapper = mountReply()
    await wrapper.get('[data-testid="reply-reference"]').trigger('click')
    expect(wrapper.emitted('jump')).toHaveLength(1)
  })

  it('is exposed as an interactive button', () => {
    const reference = mountReply().get('[data-testid="reply-reference"]')
    expect(reference.attributes('role')).toBe('button')
    expect(reference.classes()).toContain('cursor-pointer')
  })
})

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@matrix/index', () => ({
  getReactions: vi.fn().mockReturnValue([]),
  getThreadReplies: vi.fn().mockReturnValue([]),
  redactMessage: vi.fn(),
}))

vi.mock('@/electron/dialog', () => ({
  ask: vi.fn(),
}))

function createTextEvent(sender: string, body = 'Hello World') {
  return {
    getId: () => `$${sender}`,
    getType: () => 'm.room.message',
    getSender: () => sender,
    getContent: () => ({ msgtype: 'm.text', body }),
    getTs: () => 1767225600000,
    isRedacted: () => false,
  }
}

async function mountMessage(sender: string) {
  const ChatMessage = (
    await import('@/features/chat/components/ChatMessage.vue')
  ).default

  return mount(ChatMessage, {
    props: {
      event: createTextEvent(sender) as any,
      isFirst: false,
      roomId: '!room:localhost',
    },
    global: {
      stubs: {
        Avatar: true,
        LinkPreview: true,
        MessageActionBar: true,
        ReactionBar: true,
        AudioMessage: true,
        ContactCardMessage: true,
        FileMessage: true,
        ImageMessage: true,
        VideoMessage: true,
      },
    },
  })
}

describe('chatMessage bubble style', () => {
  it('keeps text content padded inside incoming message bubbles', async () => {
    const wrapper = await mountMessage('@alice:localhost')

    const bubble = wrapper.get('.message-selectable-text')
    expect(bubble.classes()).toEqual(expect.arrayContaining([
      'rounded-2xl',
      'px-3',
      'py-2',
      'bg-muted/60',
    ]))
  })

  it('keeps text content padded inside outgoing message bubbles', async () => {
    const wrapper = await mountMessage('@test:localhost')

    const bubble = wrapper.get('.message-selectable-text')
    expect(bubble.classes()).toEqual(expect.arrayContaining([
      'rounded-2xl',
      'px-3',
      'py-2',
      'bg-primary/10',
      'self-end',
    ]))
  })
})

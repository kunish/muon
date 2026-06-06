import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chatStore, isHidden, isMessageSelected, resetChatStore } from '@/features/chat/stores/chatStore'
import { SELF_USER_ID } from '../mocks/data'

const { roomsMocks, matrixMocks, askMock } = vi.hoisted(() => ({
  roomsMocks: {
    isMessagePinned: vi.fn(() => false),
    pinMessage: vi.fn(async () => {}),
    unpinMessage: vi.fn(async () => {}),
    isMessageStarred: vi.fn(() => false),
    starMessage: vi.fn(async () => {}),
    unstarMessage: vi.fn(async () => {}),
  },
  matrixMocks: {
    getReactions: vi.fn(() => []),
    getThreadReplies: vi.fn(() => []),
    redactMessage: vi.fn(async () => {}),
    sendReaction: vi.fn(async () => {}),
  },
  askMock: vi.fn(async () => true),
}))

vi.mock('@matrix/rooms', () => roomsMocks)

vi.mock('@matrix/index', () => ({
  getReactions: matrixMocks.getReactions,
  getThreadReplies: matrixMocks.getThreadReplies,
  redactMessage: matrixMocks.redactMessage,
  sendReaction: matrixMocks.sendReaction,
}))

vi.mock('@/desktop/dialog', () => ({
  ask: askMock,
}))

vi.mock('vue-sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@matrix/messages', () => ({
  forwardMessages: vi.fn(async () => {}),
}))

const STUBS = {
  Avatar: true,
  LinkPreview: true,
  ReactionBar: true,
  AudioMessage: true,
  ContactCardMessage: true,
  FileMessage: true,
  ImageMessage: true,
  VideoMessage: true,
  MessageActionBar: true,
  RawMessageDialog: true,
}

function textEvent(overrides: Record<string, unknown> = {}) {
  return {
    getId: () => '$ctx-1',
    getType: () => 'm.room.message',
    getSender: () => '@alice:localhost',
    getContent: () => ({ msgtype: 'm.text', body: 'context body' }),
    getTs: () => 1767225600000,
    isRedacted: () => false,
    ...overrides,
  }
}

async function mountWithContextMenu(event: ReturnType<typeof textEvent>) {
  const ChatMessage = (await import('@/features/chat/components/ChatMessage.vue')).default
  const wrapper = mount(ChatMessage, {
    props: { event: event as any, isFirst: false, roomId: '!room:localhost' },
    attachTo: document.body,
    global: { stubs: STUBS },
  })
  await wrapper.find('[data-testid="chat-message-row"]').trigger('contextmenu')
  await flushPromises()
  return wrapper
}

function clickContextItem(testid: string) {
  const button = document.body.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`)
  expect(button, testid).not.toBeNull()
  button!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

describe('chatMessage right-click context menu parity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChatStore()
    document.body.innerHTML = ''
    roomsMocks.isMessagePinned.mockReturnValue(false)
    roomsMocks.isMessageStarred.mockReturnValue(false)
    askMock.mockResolvedValue(true)
  })

  it('pins a message from the context menu', async () => {
    const wrapper = await mountWithContextMenu(textEvent())
    clickContextItem('context-pin')
    await flushPromises()
    expect(roomsMocks.pinMessage).toHaveBeenCalledWith('!room:localhost', '$ctx-1')
    wrapper.unmount()
  })

  it('stars a message from the context menu', async () => {
    const wrapper = await mountWithContextMenu(textEvent())
    clickContextItem('context-star')
    await flushPromises()
    expect(roomsMocks.starMessage).toHaveBeenCalledWith('!room:localhost', '$ctx-1')
    wrapper.unmount()
  })

  it('opens the forward dialog from the context menu', async () => {
    const ForwardDialog = (await import('@/features/chat/components/ForwardDialog.vue')).default
    const wrapper = await mountWithContextMenu(textEvent())
    clickContextItem('context-forward')
    await flushPromises()
    expect(wrapper.findComponent(ForwardDialog).exists()).toBe(true)
    wrapper.unmount()
  })

  it('enters multi-select from the context menu', async () => {
    const wrapper = await mountWithContextMenu(textEvent())
    clickContextItem('context-multiselect')
    await flushPromises()
    expect(chatStore.state.multiSelectMode).toBe(true)
    expect(isMessageSelected('$ctx-1')).toBe(true)
    wrapper.unmount()
  })

  it('hides a message for me from the context menu', async () => {
    const wrapper = await mountWithContextMenu(textEvent())
    clickContextItem('context-hide')
    await flushPromises()
    expect(isHidden('$ctx-1')).toBe(true)
    wrapper.unmount()
  })

  it('recalls own message from the context menu after confirmation', async () => {
    const wrapper = await mountWithContextMenu(textEvent({ getSender: () => SELF_USER_ID }))
    clickContextItem('context-recall')
    await flushPromises()
    expect(askMock).toHaveBeenCalled()
    expect(matrixMocks.redactMessage).toHaveBeenCalledWith('!room:localhost', '$ctx-1')
    wrapper.unmount()
  })

  it('does not show recall for messages from others', async () => {
    const wrapper = await mountWithContextMenu(textEvent())
    expect(document.body.querySelector('[data-testid="context-recall"]')).toBeNull()
    wrapper.unmount()
  })
})

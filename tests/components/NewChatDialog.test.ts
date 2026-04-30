import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NewChatDialog from '@/features/chat/components/NewChatDialog.vue'
import { useChatStore } from '@/features/chat/stores/chatStore'
import { mockClient } from '../mocks/matrix'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@matrix/media', () => ({
  fetchMediaBlobUrl: vi.fn(async (url: string) => `blob:${url}`),
}))

function mountNewChatDialog() {
  return mount(NewChatDialog, {
    attachTo: document.body,
    global: {
      stubs: {
        Teleport: true,
        Search: true,
        Users: true,
        X: true,
      },
    },
  })
}

describe('new chat dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockClient.createRoom).mockResolvedValue({ room_id: '!new-group:localhost' })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  async function switchToCreateGroup(wrapper: ReturnType<typeof mountNewChatDialog>) {
    const createGroupTab = wrapper
      .findAll('[role="tab"]')
      .find(tab => tab.text().includes('创建群组'))

    expect(createGroupTab).toBeTruthy()

    await createGroupTab!.trigger('mousedown', { button: 0 })
    await createGroupTab!.trigger('mouseup')
    await createGroupTab!.trigger('click')
  }

  it('keeps the dialog open when switching to create group', async () => {
    const wrapper = mountNewChatDialog()

    await switchToCreateGroup(wrapper)

    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.text()).toContain('群名称')
    expect(wrapper.find('input[placeholder="输入群名称"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('keeps the create group member picker inside a scrollable panel', async () => {
    const wrapper = mountNewChatDialog()

    await switchToCreateGroup(wrapper)

    expect(wrapper.get('[data-testid="new-chat-dialog-panel"]').classes()).toEqual(
      expect.arrayContaining(['min-h-0', 'overflow-hidden']),
    )
    expect(wrapper.get('[data-testid="new-chat-tabs"]').classes()).toEqual(
      expect.arrayContaining(['min-h-0', 'overflow-hidden']),
    )
    expect(wrapper.get('[data-testid="new-chat-group-tab-content"]').classes()).toEqual(
      expect.arrayContaining(['flex', 'min-h-0', 'flex-col', 'overflow-hidden']),
    )
    expect(wrapper.get('[data-testid="new-chat-group-form-scroll"]').classes()).toEqual(
      expect.arrayContaining(['min-h-0', 'flex-1', 'overflow-y-auto']),
    )

    wrapper.unmount()
  })

  it('promotes the newly created group with a local title preview before sync catches up', async () => {
    const wrapper = mountNewChatDialog()

    await switchToCreateGroup(wrapper)
    await wrapper.get('input[placeholder="输入群名称"]').setValue('设计评审')

    const createButton = wrapper
      .findAll('button')
      .find(button => button.text() === '创建群组' && button.attributes('role') !== 'tab')

    expect(createButton).toBeTruthy()

    await createButton!.trigger('click')
    await flushPromises()

    const preview = useChatStore().getSidebarPromotionPreview('!new-group:localhost')
    expect(preview?.name).toBe('设计评审')
    expect(preview?.isDirect).toBe(false)
  })

  it('does not close when a tab press starts inside the dialog and the final click lands on the backdrop', async () => {
    const wrapper = mountNewChatDialog()

    const backdrop = wrapper.get('.fixed.inset-0')

    await switchToCreateGroup(wrapper)
    await backdrop.trigger('click')

    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.text()).toContain('群名称')

    wrapper.unmount()
  })

  it('closes when pressing the backdrop directly', async () => {
    const wrapper = mountNewChatDialog()
    const backdrop = wrapper.get('.fixed.inset-0')

    await backdrop.trigger('pointerdown')

    expect(wrapper.emitted('close')).toHaveLength(1)

    wrapper.unmount()
  })
})

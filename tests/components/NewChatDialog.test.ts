import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NewChatDialog from '@/features/chat/components/NewChatDialog.vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
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
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps the dialog open when switching to create group', async () => {
    const wrapper = mountNewChatDialog()

    const createGroupTab = wrapper
      .findAll('[role="tab"]')
      .find(tab => tab.text().includes('创建群组'))

    expect(createGroupTab).toBeTruthy()

    await createGroupTab!.trigger('mousedown', { button: 0 })
    await createGroupTab!.trigger('mouseup')
    await createGroupTab!.trigger('click')

    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.text()).toContain('群名称')
    expect(wrapper.find('input[placeholder="输入群名称"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('does not close when a tab press starts inside the dialog and the final click lands on the backdrop', async () => {
    const wrapper = mountNewChatDialog()

    const createGroupTab = wrapper
      .findAll('[role="tab"]')
      .find(tab => tab.text().includes('创建群组'))
    const backdrop = wrapper.get('.fixed.inset-0')

    await createGroupTab!.trigger('mousedown', { button: 0 })
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

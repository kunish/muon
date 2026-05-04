import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import InviteDialog from '@/features/server/components/InviteDialog.vue'

const clipboardMocks = vi.hoisted(() => ({
  writeText: vi.fn(),
}))

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('@/matrix/client', () => ({
  getClient: () => ({
    getRoom: () => null,
  }),
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: toastMocks.error,
  },
}))

function renderSlots(name: string) {
  return defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.())
    },
  })
}

const ButtonStub = defineComponent({
  name: 'Button',
  setup(_, { attrs, slots }) {
    return () => h('button', attrs, slots.default?.())
  },
})

const InputStub = defineComponent({
  name: 'Input',
  props: {
    modelValue: {
      type: String,
      default: '',
    },
  },
  setup(props, { attrs }) {
    return () => h('input', { ...attrs, value: props.modelValue })
  },
})

function mountDialog() {
  return mount(InviteDialog, {
    props: {
      open: true,
      spaceId: '!server:localhost',
    },
    global: {
      stubs: {
        Button: ButtonStub,
        Dialog: renderSlots('Dialog'),
        DialogContent: renderSlots('DialogContent'),
        DialogDescription: renderSlots('DialogDescription'),
        DialogHeader: renderSlots('DialogHeader'),
        DialogTitle: renderSlots('DialogTitle'),
        DialogTrigger: renderSlots('DialogTrigger'),
        Input: InputStub,
        Label: renderSlots('Label'),
      },
    },
  })
}

describe('inviteDialog', () => {
  beforeEach(() => {
    clipboardMocks.writeText.mockReset()
    clipboardMocks.writeText.mockResolvedValue(undefined)
    toastMocks.error.mockReset()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardMocks.writeText,
      },
    })
  })

  it('shows a visible error when copying the invite link fails', async () => {
    clipboardMocks.writeText.mockRejectedValueOnce(new Error('permission denied'))
    const wrapper = mountDialog()

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(toastMocks.error).toHaveBeenCalledWith('无法复制邀请链接')
  })
})

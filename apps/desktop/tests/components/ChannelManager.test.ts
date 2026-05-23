import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import ChannelManager from '@/features/server/components/ChannelManager.vue'
import { useServerStore } from '@/features/server/stores/serverStore'
import { setRoomName, setRoomTopic } from '@/matrix/rooms'

const channelManagerMocks = vi.hoisted(() => ({
  getCategoryChannels: vi.fn(() => []),
  getSpaceHierarchy: vi.fn(() => ({
    categories: [],
    uncategorizedChannels: [
      {
        roomId: '!general:localhost',
        name: 'general',
        topic: 'Team updates',
        isVoice: false,
        categoryId: null,
        unreadCount: 0,
        highlightCount: 0,
        memberCount: 8,
      },
    ],
  })),
  removeRoomFromSpace: vi.fn().mockResolvedValue(undefined),
  setRoomName: vi.fn().mockResolvedValue(undefined),
  setRoomTopic: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/matrix/spaces', () => ({
  getCategoryChannels: channelManagerMocks.getCategoryChannels,
  getSpaceHierarchy: channelManagerMocks.getSpaceHierarchy,
  removeRoomFromSpace: channelManagerMocks.removeRoomFromSpace,
}))

vi.mock('@/matrix/rooms', () => ({
  setRoomName: channelManagerMocks.setRoomName,
  setRoomTopic: channelManagerMocks.setRoomTopic,
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
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, { attrs, slots }) {
    return () => h('button', { ...attrs, disabled: props.disabled }, slots.default?.())
  },
})

function createModelFieldStub(name: string, tag: 'input' | 'textarea') {
  return defineComponent({
    name,
    props: {
      modelValue: {
        type: String,
        default: '',
      },
    },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () =>
        h(tag, {
          ...attrs,
          value: props.modelValue,
          onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
        })
    },
  })
}

function mountManager() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const serverStore = useServerStore()
  const loadChannelTree = vi.spyOn(serverStore, 'loadChannelTree').mockImplementation(() => {})

  const wrapper = mount(ChannelManager, {
    props: {
      serverId: '!server:localhost',
    },
    global: {
      plugins: [pinia],
      stubs: {
        Button: ButtonStub,
        Dialog: renderSlots('Dialog'),
        DialogContent: renderSlots('DialogContent'),
        DialogDescription: renderSlots('DialogDescription'),
        DialogHeader: renderSlots('DialogHeader'),
        DialogTitle: renderSlots('DialogTitle'),
        Input: createModelFieldStub('Input', 'input'),
        Label: renderSlots('Label'),
        Textarea: createModelFieldStub('Textarea', 'textarea'),
      },
    },
  })

  return { loadChannelTree, wrapper }
}

describe('channelManager', () => {
  beforeEach(() => {
    channelManagerMocks.getCategoryChannels.mockClear()
    channelManagerMocks.getSpaceHierarchy.mockClear()
    channelManagerMocks.removeRoomFromSpace.mockClear()
    channelManagerMocks.setRoomName.mockClear()
    channelManagerMocks.setRoomTopic.mockClear()
  })

  it('edits channel name and topic from the management list', async () => {
    const { loadChannelTree, wrapper } = mountManager()
    await flushPromises()

    await wrapper.get('[data-testid="channel-manager-edit"]').trigger('click')
    await wrapper.get('[data-testid="channel-manager-edit-name"]').setValue('launch-updates')
    await wrapper.get('[data-testid="channel-manager-edit-topic"]').setValue('Release coordination')
    await wrapper.get('[data-testid="channel-manager-edit-save"]').trigger('click')
    await flushPromises()

    expect(setRoomName).toHaveBeenCalledWith('!general:localhost', 'launch-updates')
    expect(setRoomTopic).toHaveBeenCalledWith('!general:localhost', 'Release coordination')
    expect(channelManagerMocks.getSpaceHierarchy).toHaveBeenCalledWith('!server:localhost')
    expect(loadChannelTree).toHaveBeenCalledWith('!server:localhost')
  })
})

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import ChannelSidebar from '@/features/server/components/ChannelSidebar.vue'
import { useServerStore } from '@/features/server/stores/serverStore'
import { markRoomAsRead, setRoomName, setRoomTopic, toggleRoomMute } from '@/matrix/rooms'
import { removeRoomFromSpace } from '@/matrix/spaces'

const matrixRoomActions = vi.hoisted(() => ({
  markRoomAsRead: vi.fn().mockResolvedValue(undefined),
  setRoomName: vi.fn().mockResolvedValue(undefined),
  setRoomTopic: vi.fn().mockResolvedValue(undefined),
  toggleRoomMute: vi.fn().mockResolvedValue(true),
}))
const matrixSpaceActions = vi.hoisted(() => ({
  removeRoomFromSpace: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/matrix/rooms', () => ({
  markRoomAsRead: matrixRoomActions.markRoomAsRead,
  setRoomName: matrixRoomActions.setRoomName,
  setRoomTopic: matrixRoomActions.setRoomTopic,
  toggleRoomMute: matrixRoomActions.toggleRoomMute,
}))

vi.mock('@/matrix/spaces', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/matrix/spaces')>()
  return {
    ...actual,
    removeRoomFromSpace: matrixSpaceActions.removeRoomFromSpace,
  }
})

function renderSlots(name: string) {
  return defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.())
    },
  })
}

const ChannelContextMenuStub = defineComponent({
  name: 'ChannelContextMenu',
  props: {
    channel: {
      type: Object,
      required: true,
    },
  },
  emits: ['deleteChannel', 'editChannel', 'markAsRead', 'muteChannel'],
  setup(props, { emit, slots }) {
    return () => h('div', [
      h('button', {
        'data-testid': 'mark-read-channel',
        'onClick': () => emit('markAsRead', props.channel.roomId),
      }, 'mark read'),
      h('button', {
        'data-testid': 'mute-channel',
        'onClick': () => emit('muteChannel', props.channel.roomId),
      }, 'mute'),
      h('button', {
        'data-testid': 'edit-channel',
        'onClick': () => emit('editChannel', props.channel.roomId),
      }, 'edit'),
      h('button', {
        'data-testid': 'delete-channel',
        'onClick': () => emit('deleteChannel', props.channel.roomId),
      }, 'delete'),
      slots.default?.({ open: false }),
    ])
  },
})

const TextChannelItemStub = defineComponent({
  name: 'TextChannelItem',
  props: {
    channel: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    return () => h('div', { 'data-testid': 'text-channel-item' }, props.channel.name)
  },
})

const ServerDropdownStub = defineComponent({
  name: 'ServerDropdown',
  setup(_, { slots }) {
    return () => h('div', slots.trigger?.({ open: false }))
  },
})

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

const ConfirmDialogStub = defineComponent({
  name: 'ConfirmDialog',
  props: {
    confirmTestId: {
      type: String,
      default: 'confirm-dialog-confirm',
    },
    open: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['cancel', 'confirm', 'update:open'],
  setup(props, { emit }) {
    return () => props.open
      ? h('div', [
          h('button', {
            'data-testid': props.confirmTestId,
            'onClick': () => emit('confirm'),
          }, 'confirm'),
        ])
      : null
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
      return () => h(tag, {
        ...attrs,
        value: props.modelValue,
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
      })
    },
  })
}

function mountSidebar() {
  const pinia = createPinia()
  setActivePinia(pinia)

  const serverStore = useServerStore()
  serverStore.isDmMode = false
  serverStore.currentServerId = '!server:localhost'
  serverStore.servers = [{
    spaceId: '!server:localhost',
    name: 'Launch Team',
    memberCount: 8,
    childRoomIds: ['!general:localhost'],
    childSpaceIds: [],
  }]
  serverStore.channelTree = [{
    id: '__text_channels__',
    name: '__text_channels__',
    channels: [{
      roomId: '!general:localhost',
      name: 'general',
      isVoice: false,
      categoryId: null,
      unreadCount: 4,
      highlightCount: 1,
      memberCount: 8,
    }],
  }]

  const loadChannelTree = vi.spyOn(serverStore, 'loadChannelTree').mockImplementation(() => {})

  const wrapper = mount(ChannelSidebar, {
    global: {
      plugins: [pinia],
      stubs: {
        Avatar: renderSlots('Avatar'),
        Button: ButtonStub,
        ChannelCategory: renderSlots('ChannelCategory'),
        ChannelContextMenu: ChannelContextMenuStub,
        ConfirmDialog: ConfirmDialogStub,
        ConversationList: renderSlots('ConversationList'),
        CreateChannelDialog: renderSlots('CreateChannelDialog'),
        Dialog: renderSlots('Dialog'),
        DialogContent: renderSlots('DialogContent'),
        DialogDescription: renderSlots('DialogDescription'),
        DialogHeader: renderSlots('DialogHeader'),
        DialogTitle: renderSlots('DialogTitle'),
        Input: createModelFieldStub('Input', 'input'),
        Label: renderSlots('Label'),
        ScrollArea: renderSlots('ScrollArea'),
        ServerDropdown: ServerDropdownStub,
        Textarea: createModelFieldStub('Textarea', 'textarea'),
        TextChannelItem: TextChannelItemStub,
        UserPanel: renderSlots('UserPanel'),
        VoiceChannelItem: renderSlots('VoiceChannelItem'),
        VoiceStatusBar: renderSlots('VoiceStatusBar'),
        WorkspaceResizablePane: renderSlots('WorkspaceResizablePane'),
      },
    },
  })

  return { loadChannelTree, wrapper }
}

describe('channelSidebar context menu actions', () => {
  beforeEach(() => {
    matrixRoomActions.markRoomAsRead.mockClear()
    matrixRoomActions.setRoomName.mockClear()
    matrixRoomActions.setRoomTopic.mockClear()
    matrixRoomActions.toggleRoomMute.mockClear()
    matrixSpaceActions.removeRoomFromSpace.mockClear()
  })

  it('marks channels as read and refreshes the active server tree', async () => {
    const { loadChannelTree, wrapper } = mountSidebar()

    await wrapper.get('[data-testid="mark-read-channel"]').trigger('click')
    await flushPromises()

    expect(markRoomAsRead).toHaveBeenCalledWith('!general:localhost')
    expect(loadChannelTree).toHaveBeenCalledWith('!server:localhost')
  })

  it('toggles channel mute and refreshes the active server tree', async () => {
    const { loadChannelTree, wrapper } = mountSidebar()

    await wrapper.get('[data-testid="mute-channel"]').trigger('click')
    await flushPromises()

    expect(toggleRoomMute).toHaveBeenCalledWith('!general:localhost')
    expect(loadChannelTree).toHaveBeenCalledWith('!server:localhost')
  })

  it('edits channel name and topic from the context menu', async () => {
    const { loadChannelTree, wrapper } = mountSidebar()

    await wrapper.get('[data-testid="edit-channel"]').trigger('click')
    await wrapper.get('[data-testid="channel-edit-name"]').setValue('launch-updates')
    await wrapper.get('[data-testid="channel-edit-topic"]').setValue('Weekly launch decisions')
    await wrapper.get('[data-testid="channel-edit-save"]').trigger('click')
    await flushPromises()

    expect(setRoomName).toHaveBeenCalledWith('!general:localhost', 'launch-updates')
    expect(setRoomTopic).toHaveBeenCalledWith('!general:localhost', 'Weekly launch decisions')
    expect(loadChannelTree).toHaveBeenCalledWith('!server:localhost')
  })

  it('deletes a channel from the active server space from the context menu', async () => {
    const { loadChannelTree, wrapper } = mountSidebar()

    await wrapper.get('[data-testid="delete-channel"]').trigger('click')
    await wrapper.get('[data-testid="channel-delete-confirm"]').trigger('click')
    await flushPromises()

    expect(removeRoomFromSpace).toHaveBeenCalledWith('!server:localhost', '!general:localhost')
    expect(loadChannelTree).toHaveBeenCalledWith('!server:localhost')
  })
})

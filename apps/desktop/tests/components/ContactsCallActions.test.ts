import type { Component } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import ContactsPage from '@/features/contacts/components/ContactsPage.vue'
import { useContactStore } from '@/features/contacts/stores/contactStore'

const startCall = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const findOrCreateDm = vi.hoisted(() => vi.fn().mockResolvedValue('!dm_alice:localhost'))
const restoreRoom = vi.hoisted(() => vi.fn())

vi.mock('@/features/calls/stores/callStore', () => ({
  useCallStore: () => ({ startCall }),
}))

vi.mock('@matrix/index', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@matrix/index')>()),
  findOrCreateDm,
}))

vi.mock('@/features/chat/composables/useConversations', () => ({
  useConversations: () => ({ restoreRoom }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function renderSlots(name: string): Component {
  return defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.())
    },
  })
}

const ContactListStub = defineComponent({
  name: 'ContactList',
  emits: ['select'],
  setup(_, { emit }) {
    return () =>
      h(
        'button',
        {
          'data-testid': 'contacts-select-alice',
          onClick: () => emit('select', '@alice:localhost'),
        },
        'Alice',
      )
  },
})

const UserProfileStub = defineComponent({
  name: 'UserProfile',
  emits: ['audioCall', 'message', 'videoCall'],
  setup(_, { emit }) {
    return () =>
      h('div', [
        h(
          'button',
          {
            'data-testid': 'contacts-audio-call',
            onClick: () => emit('audioCall', '@alice:localhost'),
          },
          'audio',
        ),
        h(
          'button',
          {
            'data-testid': 'contacts-video-call',
            onClick: () => emit('videoCall', '@alice:localhost'),
          },
          'video',
        ),
      ])
  },
})

function mountContactsPage() {
  const store = useContactStore()
  store.contacts = [{ userId: '@alice:localhost', displayName: 'Alice', presence: 'online' }]
  store.selectedContactId = '@alice:localhost'

  return mount(ContactsPage, {
    global: {
      stubs: {
        ContactList: ContactListStub,
        CreateGroupDialog: true,
        GroupSettings: true,
        UserProfile: UserProfileStub,
        WorkspaceResizablePane: renderSlots('WorkspaceResizablePane'),
      },
    },
  })
}

describe('contacts call actions', () => {
  beforeEach(() => {
    startCall.mockClear()
    findOrCreateDm.mockClear()
    restoreRoom.mockClear()
  })

  it('starts an audio call with the selected contact through the call store', async () => {
    const wrapper = mountContactsPage()

    await wrapper.get('[data-testid="contacts-audio-call"]').trigger('click')
    await Promise.resolve()

    expect(findOrCreateDm).toHaveBeenCalledWith('@alice:localhost')
    expect(startCall).toHaveBeenCalledWith('!dm_alice:localhost', '@alice:localhost', '小红', 'audio')
  })

  it('starts a video call with the selected contact through the call store', async () => {
    const wrapper = mountContactsPage()

    await wrapper.get('[data-testid="contacts-video-call"]').trigger('click')
    await Promise.resolve()

    expect(findOrCreateDm).toHaveBeenCalledWith('@alice:localhost')
    expect(startCall).toHaveBeenCalledWith('!dm_alice:localhost', '@alice:localhost', '小红', 'video')
  })
})

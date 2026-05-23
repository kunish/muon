import type { Component } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { consumePendingContactCall } from '@/features/calls/stores/callLaunchStore'
import ContactsPage from '@/features/contacts/components/ContactsPage.vue'
import { useContactStore } from '@/features/contacts/stores/contactStore'

const contactsRouterPush = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: contactsRouterPush,
  }),
}))

vi.mock('@/features/chat/composables/useConversations', () => ({
  useConversations: () => ({
    restoreRoom: vi.fn(),
  }),
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
    contactsRouterPush.mockClear()
    consumePendingContactCall()
  })

  it('queues an audio call for the selected contact and opens calls', async () => {
    const wrapper = mountContactsPage()

    await wrapper.get('[data-testid="contacts-audio-call"]').trigger('click')

    expect(consumePendingContactCall()).toEqual({
      userId: '@alice:localhost',
      displayName: '小红',
      mode: 'audio',
    })
    expect(contactsRouterPush).toHaveBeenCalledWith('/calls')
  })

  it('queues a video call for the selected contact and opens calls', async () => {
    const wrapper = mountContactsPage()

    await wrapper.get('[data-testid="contacts-video-call"]').trigger('click')

    expect(consumePendingContactCall()).toEqual({
      userId: '@alice:localhost',
      displayName: '小红',
      mode: 'video',
    })
    expect(contactsRouterPush).toHaveBeenCalledWith('/calls')
  })
})

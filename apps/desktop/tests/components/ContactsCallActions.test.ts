import type { Component } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import ContactsPage from '@/features/contacts/components/ContactsPage.vue'
import { resetContactStore, selectContact } from '@/features/contacts/stores/contactStore'

const startCall = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const findOrCreateDm = vi.hoisted(() => vi.fn().mockResolvedValue('!dm_alice:localhost'))
const restoreRoom = vi.hoisted(() => vi.fn())

const contactsSeed = vi.hoisted(() => ({ contacts: [] as any[], groups: [] as any[] }))
vi.mock('@/features/contacts/queries/useContacts', () => ({
  useContactsQuery: () => ({
    contacts: {
      get value() {
        return contactsSeed.contacts
      },
    },
    refetch: vi.fn().mockResolvedValue(undefined),
  }),
  useGroupsQuery: () => ({
    groups: {
      get value() {
        return contactsSeed.groups
      },
    },
    refetch: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/features/calls/stores/callStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/calls/stores/callStore')>()),
  startCall,
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
  // The call name comes from the contacts query (displayName), and the assertion
  // expects alice's real display name '小红' (see tests/mocks/data.ts). Previously the
  // real query supplied it; now the seeded query data must carry the same value.
  contactsSeed.contacts = [{ userId: '@alice:localhost', displayName: '小红', presence: 'online' }]
  selectContact('@alice:localhost')

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
    resetContactStore()
    localStorage.clear()
    contactsSeed.contacts = []
    contactsSeed.groups = []
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

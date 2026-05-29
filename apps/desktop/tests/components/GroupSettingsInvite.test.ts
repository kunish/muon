import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GroupSettings from '@/features/contacts/components/GroupSettings.vue'
import { useContactStore } from '@/features/contacts/stores/contactStore'
import { mockClient } from '../mocks/matrix'

vi.mock('@matrix/media', () => ({
  fetchMediaBlobUrl: vi.fn(async (url: string) => `blob:${url}`),
}))

vi.mock('@/shared/composables/useRoomPermissions', () => ({
  useRoomPermissions: () => ({
    isModerator: { value: true },
  }),
}))

vi.mock('@shared/composables/useRoomNavigation', () => ({
  useRoomNavigation: () => ({
    currentRoomId: { value: null },
    navigateToRoom: vi.fn(),
  }),
}))

vi.mock('@/desktop/dialog', () => ({
  ask: vi.fn(),
}))

function seedContacts() {
  const store = useContactStore()
  store.contacts = [
    { userId: '@alice:localhost', displayName: 'Alice Chen', presence: 'online' },
    { userId: '@fiona:localhost', displayName: 'Fiona Lin', presence: 'online' },
    { userId: '@george:localhost', displayName: 'George Wu', presence: 'offline' },
  ]
}

function mountGroupSettings() {
  return mount(GroupSettings, {
    props: {
      roomId: '!group_project:localhost',
    },
  })
}

describe('group settings invite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedContacts()
  })

  it('selects multiple non-member contacts before inviting them to the group', async () => {
    const wrapper = mountGroupSettings()

    await wrapper.get('[data-testid="group-settings-toggle-invite"]').trigger('click')

    expect(wrapper.find('[data-testid="group-member-row-@alice:localhost"]').exists()).toBe(false)
    await wrapper.get('[data-testid="group-member-row-@fiona:localhost"]').trigger('click')
    await wrapper.get('[data-testid="group-member-row-@george:localhost"]').trigger('click')

    expect(wrapper.get('[data-testid="selected-members-count"]').text()).toBe('已选 2 人')

    await wrapper.get('[data-testid="group-settings-invite-submit"]').trigger('click')
    await flushPromises()

    expect(mockClient.invite).toHaveBeenCalledWith('!group_project:localhost', '@fiona:localhost')
    expect(mockClient.invite).toHaveBeenCalledWith('!group_project:localhost', '@george:localhost')
    expect(wrapper.find('[data-testid="group-member-row-@fiona:localhost"]').exists()).toBe(false)
  })

  it('uploads a new group avatar from the admin control', async () => {
    const wrapper = mountGroupSettings()

    expect(wrapper.find('[data-testid="group-settings-change-avatar"]').exists()).toBe(true)

    const input = wrapper.get('[data-testid="group-settings-avatar-input"]')
    const file = new File(['avatar-bytes'], 'group.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(mockClient.uploadContent).toHaveBeenCalledWith(file, { type: 'image/png' })
    expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
      '!group_project:localhost',
      'm.room.avatar',
      { url: 'mxc://localhost/mock' },
      '',
    )
  })
})

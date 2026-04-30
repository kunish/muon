import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CreateGroupDialog from '@/features/contacts/components/CreateGroupDialog.vue'
import { useContactStore } from '@/features/contacts/stores/contactStore'
import { mockClient } from '../mocks/matrix'

vi.mock('@matrix/media', () => ({
  fetchMediaBlobUrl: vi.fn(async (url: string) => `blob:${url}`),
}))

function seedContacts() {
  const store = useContactStore()
  store.contacts = [
    { userId: '@alice:localhost', displayName: 'Alice Chen', avatarUrl: 'mxc://localhost/alice', presence: 'online' },
    { userId: '@bob:localhost', displayName: 'Bob Li', avatarUrl: 'mxc://localhost/bob', presence: 'offline' },
    { userId: '@carol:localhost', displayName: 'Carol Wu', presence: 'unavailable' },
  ]
}

function mountCreateGroupDialog() {
  return mount(CreateGroupDialog, {
    global: {
      stubs: {
        Lock: true,
        X: true,
      },
    },
  })
}

describe('create group dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockClient.createRoom).mockResolvedValue({ room_id: '!team:localhost' })
    seedContacts()
  })

  it('selects multiple members from the contact list before creating the group', async () => {
    const wrapper = mountCreateGroupDialog()

    await wrapper.get('input[placeholder="输入群名称"]').setValue('设计讨论')
    await wrapper.get('[data-testid="group-member-row-@alice:localhost"]').trigger('click')
    await wrapper.get('[data-testid="group-member-row-@bob:localhost"]').trigger('click')

    expect(wrapper.get('[data-testid="selected-member-chip-@alice:localhost"]').text()).toContain('Alice Chen')
    expect(wrapper.get('[data-testid="selected-member-chip-@bob:localhost"]').text()).toContain('Bob Li')

    await wrapper.get('[data-testid="create-group-submit"]').trigger('click')
    await flushPromises()

    expect(mockClient.createRoom).toHaveBeenCalledWith(expect.objectContaining({
      name: '设计讨论',
      invite: ['@alice:localhost', '@bob:localhost'],
    }))
    expect(wrapper.emitted('created')).toEqual([['!team:localhost']])
  })

  it('filters selectable members while preserving the selected member tray', async () => {
    const wrapper = mountCreateGroupDialog()

    await wrapper.get('[data-testid="group-member-row-@alice:localhost"]').trigger('click')
    await wrapper.get('[data-testid="group-member-search"]').setValue('bob')

    expect(wrapper.find('[data-testid="group-member-row-@alice:localhost"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="group-member-row-@bob:localhost"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="selected-member-chip-@alice:localhost"]').text()).toContain('Alice Chen')
  })
})

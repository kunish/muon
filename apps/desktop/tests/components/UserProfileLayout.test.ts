import { flushPromises, mount } from '@vue/test-utils'
import { EventType } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UserProfile from '@/features/contacts/components/UserProfile.vue'
import { contactProfileFor, resetContactStore, selectContact } from '@/features/contacts/stores/contactStore'
import { mockClient } from '../mocks/matrix'

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

describe('userProfile layout', () => {
  beforeEach(() => {
    resetContactStore()
    localStorage.clear()
    contactsSeed.contacts = []
    contactsSeed.groups = []
  })

  it('fills the contact detail pane when a contact is selected', () => {
    contactsSeed.contacts = [{ userId: '@alice:localhost', displayName: 'Alice', presence: 'offline' }]
    selectContact('@alice:localhost')
    mockClient.setAccountData.mockClear()

    const wrapper = mount(UserProfile)

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['flex-1', 'w-full', 'min-w-0', 'overflow-y-auto']))
  })

  it('keeps the empty state full width in the contact detail pane', () => {
    const wrapper = mount(UserProfile)

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['flex-1', 'w-full', 'min-w-0', 'justify-center']))
  })

  it('lets the selected contact keep local relationship notes and controls', async () => {
    contactsSeed.contacts = [{ userId: '@alice:localhost', displayName: 'Alice', presence: 'offline' }]
    selectContact('@alice:localhost')

    const wrapper = mount(UserProfile)

    await wrapper.get('[data-testid="contacts-toggle-favorite"]').trigger('click')
    await wrapper.get('[data-testid="contacts-profile-tag-input"]').setValue('项目伙伴')
    await wrapper.get('[data-testid="contacts-profile-note-input"]').setValue('负责移动端验收')
    await wrapper.get('[data-testid="contacts-save-profile"]').trigger('click')
    await wrapper.get('[data-testid="contacts-toggle-blocked"]').trigger('click')
    await flushPromises()

    expect(contactProfileFor('@alice:localhost')).toMatchObject({
      isBlocked: true,
      isFavorite: true,
      note: '负责移动端验收',
      tag: '项目伙伴',
    })
    expect(mockClient.setAccountData).toHaveBeenCalledWith(EventType.IgnoredUserList, {
      ignored_users: { '@alice:localhost': {} },
    })
    expect(wrapper.get('[data-testid="contacts-profile-status"]').text()).toContain('已星标')
    expect(wrapper.get('[data-testid="contacts-profile-status"]').text()).toContain('已屏蔽')
  })
})

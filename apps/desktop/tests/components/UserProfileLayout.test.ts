import { flushPromises, mount } from '@vue/test-utils'
import { EventType } from 'matrix-js-sdk'
import { describe, expect, it } from 'vitest'
import UserProfile from '@/features/contacts/components/UserProfile.vue'
import { useContactStore } from '@/features/contacts/stores/contactStore'
import { mockClient } from '../mocks/matrix'

describe('userProfile layout', () => {
  it('fills the contact detail pane when a contact is selected', () => {
    const store = useContactStore()
    store.contacts = [{ userId: '@alice:localhost', displayName: 'Alice', presence: 'offline' }]
    store.selectedContactId = '@alice:localhost'
    mockClient.setAccountData.mockClear()

    const wrapper = mount(UserProfile)

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['flex-1', 'w-full', 'min-w-0', 'overflow-y-auto']))
  })

  it('keeps the empty state full width in the contact detail pane', () => {
    const wrapper = mount(UserProfile)

    expect(wrapper.classes()).toEqual(expect.arrayContaining(['flex-1', 'w-full', 'min-w-0', 'justify-center']))
  })

  it('lets the selected contact keep local relationship notes and controls', async () => {
    const store = useContactStore()
    store.contacts = [{ userId: '@alice:localhost', displayName: 'Alice', presence: 'offline' }]
    store.selectedContactId = '@alice:localhost'

    const wrapper = mount(UserProfile)

    await wrapper.get('[data-testid="contacts-toggle-favorite"]').trigger('click')
    await wrapper.get('[data-testid="contacts-profile-tag-input"]').setValue('项目伙伴')
    await wrapper.get('[data-testid="contacts-profile-note-input"]').setValue('负责移动端验收')
    await wrapper.get('[data-testid="contacts-save-profile"]').trigger('click')
    await wrapper.get('[data-testid="contacts-toggle-blocked"]').trigger('click')
    await flushPromises()

    expect(store.contactProfileFor('@alice:localhost')).toMatchObject({
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

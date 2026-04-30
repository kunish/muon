import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UserProfile from '@/features/contacts/components/UserProfile.vue'
import { useContactStore } from '@/features/contacts/stores/contactStore'

describe('userProfile layout', () => {
  it('fills the contact detail pane when a contact is selected', () => {
    const store = useContactStore()
    store.contacts = [
      { userId: '@alice:localhost', displayName: 'Alice', presence: 'offline' },
    ]
    store.selectedContactId = '@alice:localhost'

    const wrapper = mount(UserProfile)

    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['flex-1', 'w-full', 'min-w-0', 'overflow-y-auto']),
    )
  })

  it('keeps the empty state full width in the contact detail pane', () => {
    const wrapper = mount(UserProfile)

    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['flex-1', 'w-full', 'min-w-0', 'justify-center']),
    )
  })
})

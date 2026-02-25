import { describe, expect, it } from 'vitest'
import { useContactStore } from '@/features/contacts/stores/contactStore'

describe('contactStore', () => {
  it('should have empty contacts by default', () => {
    const store = useContactStore()
    expect(store.contacts).toEqual([])
    expect(store.groups).toEqual([])
  })

  it('should filter contacts by search query', () => {
    const store = useContactStore()
    store.contacts = [
      { userId: '@alice:localhost', displayName: 'Alice', presence: 'online' },
      { userId: '@bob:localhost', displayName: 'Bob', presence: 'offline' },
    ] as any

    store.searchQuery = 'ali'
    expect(store.filteredContacts).toHaveLength(1)
    expect(store.filteredContacts[0].displayName).toBe('Alice')
  })

  it('should return all contacts when search is empty', () => {
    const store = useContactStore()
    store.contacts = [
      { userId: '@alice:localhost', displayName: 'Alice', presence: 'online' },
      { userId: '@bob:localhost', displayName: 'Bob', presence: 'offline' },
    ] as any

    store.searchQuery = ''
    expect(store.filteredContacts).toHaveLength(2)
  })

  it('should track selected contact', () => {
    const store = useContactStore()
    store.selectedContactId = '@alice:localhost'

    expect(store.selectedContactId).toBe('@alice:localhost')
  })
})

import { describe, expect, it, vi } from 'vitest'
import { useContactStore } from '@/features/contacts/stores/contactStore'
import { mockClient } from '../../mocks/matrix'

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

  it('filters groups by the shared contact search query', () => {
    const store = useContactStore()
    store.groups = [
      { roomId: '!product:localhost', name: '产品设计', memberCount: 7 },
      { roomId: '!family:localhost', name: '家庭群', memberCount: 4 },
    ]

    store.searchQuery = '产品'

    expect(store.filteredGroups).toHaveLength(1)
    expect(store.filteredGroups[0].name).toBe('产品设计')
  })

  it('should track selected contact', () => {
    const store = useContactStore()
    store.selectedContactId = '@alice:localhost'

    expect(store.selectedContactId).toBe('@alice:localhost')
  })

  it('loads contacts with mxc avatars so the Avatar component can resolve media fallbacks', async () => {
    const store = useContactStore()
    const otherMember = {
      userId: '@avatar:localhost',
      name: 'Avatar User',
      getMxcAvatarUrl: vi.fn().mockReturnValue('mxc://localhost/avatar_uploaded'),
      getAvatarUrl: vi.fn().mockReturnValue('http://127.0.0.1:6167/_matrix/media/v3/thumbnail/localhost/avatar_uploaded'),
    }
    const meMember = {
      userId: '@test:localhost',
      name: 'Me',
      getMxcAvatarUrl: vi.fn().mockReturnValue('mxc://localhost/avatar_me'),
      getAvatarUrl: vi.fn(),
    }

    vi.mocked(mockClient.getUserId).mockReturnValue('@test:localhost')
    vi.mocked(mockClient.getRooms).mockReturnValue([
      {
        getJoinedMembers: () => [meMember, otherMember],
      },
    ] as any)

    await store.loadContacts()

    expect(store.contacts).toEqual([
      {
        userId: '@avatar:localhost',
        displayName: 'Avatar User',
        avatarUrl: 'mxc://localhost/avatar_uploaded',
        presence: 'offline',
      },
    ])
    expect(otherMember.getAvatarUrl).not.toHaveBeenCalled()
  })

  it('skips the local homeserver system account from contacts', async () => {
    const store = useContactStore()
    const systemMember = {
      userId: '@conduit:localhost',
      name: '@conduit:localhost',
      getMxcAvatarUrl: vi.fn(),
    }
    const meMember = {
      userId: '@test:localhost',
      name: 'Me',
      getMxcAvatarUrl: vi.fn(),
    }

    vi.mocked(mockClient.getUserId).mockReturnValue('@test:localhost')
    vi.mocked(mockClient.getRooms).mockReturnValue([
      {
        getJoinedMembers: () => [meMember, systemMember],
      },
    ] as any)

    await store.loadContacts()

    expect(store.contacts).toEqual([])
  })
})

import type { Contact, GroupInfo } from '@/features/contacts/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { filterContacts, filterGroups, loadContacts, loadGroups } from '@/features/contacts/queries/contactsApi'

const getRoomsMock = vi.fn()
const getUserIdMock = vi.fn()

vi.mock('@matrix/client', () => ({
  getClient: () => ({
    getRooms: () => getRoomsMock(),
    getUserId: () => getUserIdMock(),
  }),
}))

function dmRoom(otherUserId: string, name: string, avatar: string | null = null) {
  return {
    roomId: `!dm-${otherUserId}:localhost`,
    getJoinedMemberCount: () => 2,
    getJoinedMembers: () => [
      { userId: '@me:localhost', name: 'Me', getMxcAvatarUrl: () => null },
      { userId: otherUserId, name, getMxcAvatarUrl: () => avatar },
    ],
  }
}

function groupRoom(roomId: string, name: string, memberCount: number) {
  return {
    roomId,
    name,
    getJoinedMemberCount: () => memberCount,
    getJoinedMembers: () => Array.from({ length: memberCount }, (_, i) => ({ userId: `@u${i}:localhost` })),
  }
}

beforeEach(() => {
  getRoomsMock.mockReset()
  getUserIdMock.mockReset()
  getUserIdMock.mockReturnValue('@me:localhost')
  getRoomsMock.mockReturnValue([])
})

describe('contactsApi', () => {
  it('loadContacts derives DM contacts, sorts by display name, and keeps mxc avatars', async () => {
    getRoomsMock.mockReturnValue([
      dmRoom('@bob:localhost', 'Bob'),
      dmRoom('@alice:localhost', 'Alice', 'mxc://localhost/alice'),
    ])

    const contacts = await loadContacts()

    expect(contacts).toEqual<Contact[]>([
      { userId: '@alice:localhost', displayName: 'Alice', avatarUrl: 'mxc://localhost/alice', presence: 'offline' },
      { userId: '@bob:localhost', displayName: 'Bob', avatarUrl: undefined, presence: 'offline' },
    ])
  })

  it('loadContacts dedupes a contact appearing in multiple DM rooms', async () => {
    getRoomsMock.mockReturnValue([dmRoom('@alice:localhost', 'Alice'), dmRoom('@alice:localhost', 'Alice Again')])

    const contacts = await loadContacts()

    expect(contacts.map((c) => c.userId)).toEqual(['@alice:localhost'])
    expect(contacts[0].displayName).toBe('Alice')
  })

  it('loadContacts skips the local homeserver system account', async () => {
    getRoomsMock.mockReturnValue([dmRoom('@conduit:localhost', '@conduit:localhost')])

    const contacts = await loadContacts()

    expect(contacts).toEqual([])
  })

  it('loadContacts ignores rooms that are not exactly two members', async () => {
    getRoomsMock.mockReturnValue([groupRoom('!group:localhost', 'Team', 5)])

    const contacts = await loadContacts()

    expect(contacts).toEqual([])
  })

  it('loadGroups returns rooms with more than two joined members', async () => {
    getRoomsMock.mockReturnValue([groupRoom('!team:localhost', 'Team', 5), dmRoom('@alice:localhost', 'Alice')])

    const groups = await loadGroups()

    expect(groups).toEqual<GroupInfo[]>([{ roomId: '!team:localhost', name: 'Team', memberCount: 5 }])
  })

  it('filterContacts matches display name or user id, case-insensitively, and passes all through on empty query', () => {
    const contacts: Contact[] = [
      { userId: '@alice:localhost', displayName: 'Alice', presence: 'online' },
      { userId: '@bob:localhost', displayName: 'Bob', presence: 'offline' },
    ]

    expect(filterContacts(contacts, '  ')).toHaveLength(2)
    expect(filterContacts(contacts, 'ALI').map((c) => c.userId)).toEqual(['@alice:localhost'])
    expect(filterContacts(contacts, 'bob:local').map((c) => c.userId)).toEqual(['@bob:localhost'])
  })

  it('filterGroups matches group name or room id, and passes all through on empty query', () => {
    const groups: GroupInfo[] = [
      { roomId: '!product:localhost', name: '产品设计', memberCount: 7 },
      { roomId: '!family:localhost', name: '家庭群', memberCount: 4 },
    ]

    expect(filterGroups(groups, '')).toHaveLength(2)
    expect(filterGroups(groups, '产品').map((g) => g.name)).toEqual(['产品设计'])
    expect(filterGroups(groups, 'family').map((g) => g.roomId)).toEqual(['!family:localhost'])
  })
})

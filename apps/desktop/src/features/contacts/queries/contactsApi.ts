import type { Contact, GroupInfo } from '../types'
import { getClient } from '@matrix/client'

function isSystemContact(userId: string): boolean {
  return userId.startsWith('@conduit:')
}

/** Derive 1:1 DM contacts from the joined two-member rooms, deduped and name-sorted. */
export async function loadContacts(): Promise<Contact[]> {
  const client = getClient()
  const rooms = client.getRooms()
  const dmMap = new Map<string, Contact>()

  for (const room of rooms) {
    const members = room.getJoinedMembers()
    if (members.length === 2) {
      const other = members.find((m) => m.userId !== client.getUserId())
      if (other && !isSystemContact(other.userId) && !dmMap.has(other.userId)) {
        dmMap.set(other.userId, {
          userId: other.userId,
          displayName: other.name || other.userId,
          avatarUrl: other.getMxcAvatarUrl() || undefined,
          presence: 'offline',
        })
      }
    }
  }

  return Array.from(dmMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName))
}

/** Derive group rooms (more than two joined members) from the matrix client. */
export async function loadGroups(): Promise<GroupInfo[]> {
  const client = getClient()
  const rooms = client.getRooms()

  return rooms
    .filter((r) => r.getJoinedMemberCount() > 2)
    .map((r) => ({
      roomId: r.roomId,
      name: r.name || r.roomId,
      memberCount: r.getJoinedMemberCount(),
    }))
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

export function filterContacts(contacts: Contact[], query: string): Contact[] {
  const q = normalizeQuery(query)
  if (!q) return contacts
  return contacts.filter((c) => c.displayName.toLowerCase().includes(q) || c.userId.toLowerCase().includes(q))
}

export function filterGroups(groups: GroupInfo[], query: string): GroupInfo[] {
  const q = normalizeQuery(query)
  if (!q) return groups
  return groups.filter((g) => g.name.toLowerCase().includes(q) || g.roomId.toLowerCase().includes(q))
}

import { getClient } from '@matrix/client'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface Contact {
  userId: string
  displayName: string
  avatarUrl?: string
  presence: 'online' | 'offline' | 'unavailable'
}

export interface GroupInfo {
  roomId: string
  name: string
  memberCount: number
  avatarUrl?: string
}

function isSystemContact(userId: string): boolean {
  return userId.startsWith('@conduit:')
}

export const useContactStore = defineStore('contacts', () => {
  const contacts = ref<Contact[]>([])
  const groups = ref<GroupInfo[]>([])
  const searchQuery = ref('')
  const selectedContactId = ref<string | null>(null)

  async function loadContacts() {
    const client = getClient()
    const rooms = client.getRooms()
    const dmMap = new Map<string, Contact>()

    for (const room of rooms) {
      const members = room.getJoinedMembers()
      if (members.length === 2) {
        const other = members.find(m => m.userId !== client.getUserId())
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

    contacts.value = Array.from(dmMap.values())
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  }

  async function loadGroups() {
    const client = getClient()
    const rooms = client.getRooms()

    groups.value = rooms
      .filter(r => r.getJoinedMemberCount() > 2)
      .map(r => ({
        roomId: r.roomId,
        name: r.name || r.roomId,
        memberCount: r.getJoinedMemberCount(),
      }))
  }

  const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase())

  const filteredContacts = computed(() => {
    const q = normalizedSearchQuery.value
    if (!q)
      return contacts.value
    return contacts.value.filter(c =>
      c.displayName.toLowerCase().includes(q) || c.userId.toLowerCase().includes(q),
    )
  })

  const filteredGroups = computed(() => {
    const q = normalizedSearchQuery.value
    if (!q)
      return groups.value
    return groups.value.filter(g =>
      g.name.toLowerCase().includes(q) || g.roomId.toLowerCase().includes(q),
    )
  })

  return {
    contacts,
    groups,
    searchQuery,
    selectedContactId,
    filteredContacts,
    filteredGroups,
    loadContacts,
    loadGroups,
  }
})

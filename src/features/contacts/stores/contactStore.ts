import { getClient } from '@matrix/client'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface Contact {
  userId: string
  displayName: string
  avatarUrl?: string
  presence: 'online' | 'offline' | 'unavailable'
}

interface GroupInfo {
  roomId: string
  name: string
  memberCount: number
  avatarUrl?: string
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
        if (other && !dmMap.has(other.userId)) {
          dmMap.set(other.userId, {
            userId: other.userId,
            displayName: other.name || other.userId,
            avatarUrl: other.getAvatarUrl(client.getHomeserverUrl(), 40, 40, 'crop', false, false) || undefined,
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

  const filteredContacts = computed(() => {
    if (!searchQuery.value)
      return contacts.value
    const q = searchQuery.value.toLowerCase()
    return contacts.value.filter(c =>
      c.displayName.toLowerCase().includes(q) || c.userId.toLowerCase().includes(q),
    )
  })

  return {
    contacts,
    groups,
    searchQuery,
    selectedContactId,
    filteredContacts,
    loadContacts,
    loadGroups,
  }
})

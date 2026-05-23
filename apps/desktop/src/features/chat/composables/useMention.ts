import { getRoom } from '@matrix/index'
import { useContactList } from '@shared/composables/useContactList'
import { computed } from 'vue'
import { useChatStore } from '../stores/chatStore'

interface MentionMember {
  id: string
  label: string
  /** mxc:// 格式的头像 URL，需要通过 useAuthMedia / fetchMediaBlobUrl 转换后才能使用 */
  avatar?: string
  isInCurrentRoom: boolean
}

export function useMention() {
  const store = useChatStore()
  const contactList = useContactList()

  if (contactList.contacts.length === 0) {
    void contactList.loadContacts().catch(() => {})
  }

  const mentionCandidates = computed<MentionMember[]>(() => {
    const candidates = new Map<string, MentionMember>()
    const roomId = store.currentRoomId
    if (roomId) {
      const room = getRoom(roomId)
      if (room) {
        for (const m of room.getJoinedMembers()) {
          candidates.set(m.userId, {
            id: m.userId,
            label: m.name || m.userId,
            avatar: m.getMxcAvatarUrl() || undefined,
            isInCurrentRoom: true,
          })
        }
      }
    }

    for (const contact of contactList.contacts) {
      if (candidates.has(contact.userId)) continue
      candidates.set(contact.userId, {
        id: contact.userId,
        label: contact.displayName || contact.userId,
        avatar: contact.avatarUrl,
        isInCurrentRoom: false,
      })
    }

    return Array.from(candidates.values())
  })

  function filterMembers(query: string): MentionMember[] {
    const q = query.toLowerCase()
    return mentionCandidates.value
      .filter((m) => m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
      .slice(0, 8) // 最多显示 8 个结果
  }

  return { filterMembers }
}

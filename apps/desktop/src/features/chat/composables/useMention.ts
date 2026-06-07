import { getRoom } from '@matrix/index'
import { useContactList } from '@shared/composables/useContactList'
import { useSelector } from '@tanstack/vue-store'
import { localizedText } from '@/shared/lib/localizedText'
import { chatStore } from '../stores/chatStore'

/** @所有人 的哨兵 mention id（发送时转为 m.mentions.room） */
export const ROOM_MENTION_ID = '@room'

interface MentionMember {
  id: string
  label: string
  /** mxc:// 格式的头像 URL，需要通过 useAuthMedia / fetchMediaBlobUrl 转换后才能使用 */
  avatar?: string
  isInCurrentRoom: boolean
}

export function useMention() {
  const currentRoomId = useSelector(chatStore, (s) => s.currentRoomId)
  // The contacts query auto-fetches on mount, so no explicit load is needed here.
  const contactList = useContactList()

  const mentionCandidates = computed<MentionMember[]>(() => {
    const candidates = new Map<string, MentionMember>()
    const roomId = currentRoomId.value
    let isGroupRoom = false
    if (roomId) {
      const room = getRoom(roomId)
      if (room) {
        const members = room.getJoinedMembers()
        // 群聊（成员多于 2 人）才提供 @所有人
        isGroupRoom = members.length > 2
        for (const m of members) {
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

    const list = Array.from(candidates.values())
    if (isGroupRoom) {
      // @所有人 置顶
      list.unshift({ id: ROOM_MENTION_ID, label: localizedText('chat.mention_all'), isInCurrentRoom: true })
    }
    return list
  })

  function filterMembers(query: string): MentionMember[] {
    const q = query.toLowerCase()
    return mentionCandidates.value
      .filter((m) => m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
      .slice(0, 8) // 最多显示 8 个结果
  }

  return { filterMembers }
}

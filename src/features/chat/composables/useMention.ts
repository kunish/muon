import { getRoom } from '@matrix/index'
import { computed } from 'vue'
import { useChatStore } from '../stores/chatStore'

interface MentionMember {
  id: string
  label: string
  /** mxc:// 格式的头像 URL，需要通过 useAuthMedia / fetchMediaBlobUrl 转换后才能使用 */
  avatar?: string
}

export function useMention() {
  const store = useChatStore()

  const members = computed<MentionMember[]>(() => {
    const roomId = store.currentRoomId
    if (!roomId)
      return []
    const room = getRoom(roomId)
    if (!room)
      return []
    return room.getJoinedMembers().map(m => ({
      id: m.userId,
      label: m.name || m.userId,
      avatar: m.getMxcAvatarUrl() || undefined,
    }))
  })

  function filterMembers(query: string): MentionMember[] {
    const q = query.toLowerCase()
    return members.value
      .filter(m => m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
      .slice(0, 8) // 最多显示 8 个结果
  }

  return { filterMembers }
}

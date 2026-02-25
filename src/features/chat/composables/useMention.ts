import { getRoom } from '@matrix/index'
import { computed } from 'vue'
import { useChatStore } from '../stores/chatStore'

export function useMention() {
  const store = useChatStore()

  const members = computed(() => {
    const roomId = store.currentRoomId
    if (!roomId)
      return []
    const room = getRoom(roomId)
    if (!room)
      return []
    return room.getJoinedMembers().map(m => ({
      id: m.userId,
      label: m.name || m.userId,
    }))
  })

  function filterMembers(query: string) {
    const q = query.toLowerCase()
    return members.value.filter(m =>
      m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
    )
  }

  return { members, filterMembers }
}

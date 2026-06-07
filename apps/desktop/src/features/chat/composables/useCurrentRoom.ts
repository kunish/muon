import { getRoom } from '@matrix/index'
import { useSelector } from '@tanstack/vue-store'
import { chatStore } from '../stores/chatStore'

export function useCurrentRoom() {
  const currentRoomId = useSelector(chatStore, (s) => s.currentRoomId)

  const room = computed(() => {
    if (!currentRoomId.value) return null
    return getRoom(currentRoomId.value)
  })

  return { room, currentRoomId }
}

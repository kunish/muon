import { getRoom } from '@matrix/index'
import { computed } from 'vue'
import { useChatStore } from '../stores/chatStore'

export function useCurrentRoom() {
  const store = useChatStore()

  const room = computed(() => {
    if (!store.currentRoomId)
      return null
    return getRoom(store.currentRoomId)
  })

  return { room, currentRoomId: computed(() => store.currentRoomId) }
}

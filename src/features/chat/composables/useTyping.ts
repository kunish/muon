import { matrixEvents, sendTyping } from '@matrix/index'
import { onMounted, onUnmounted, ref } from 'vue'
import { useChatStore } from '../stores/chatStore'

export function useTyping() {
  const store = useChatStore()
  const typingUsers = ref<string[]>([])
  let typingTimer: ReturnType<typeof setTimeout> | null = null

  function onTypingEvent(payload: { roomId: string, userIds: string[] }) {
    if (payload.roomId === store.currentRoomId)
      typingUsers.value = payload.userIds
  }

  function startTyping() {
    const roomId = store.currentRoomId
    if (!roomId)
      return
    sendTyping(roomId, true, 5000)
    if (typingTimer)
      clearTimeout(typingTimer)
    typingTimer = setTimeout(() => {
      sendTyping(roomId, false)
    }, 3000)
  }

  function stopTyping() {
    const roomId = store.currentRoomId
    if (!roomId)
      return
    if (typingTimer) {
      clearTimeout(typingTimer)
      typingTimer = null
    }
    sendTyping(roomId, false)
  }

  onMounted(() => {
    matrixEvents.on('room.typing', onTypingEvent)
  })

  onUnmounted(() => {
    matrixEvents.off('room.typing', onTypingEvent)
    if (typingTimer)
      clearTimeout(typingTimer)
  })

  return { typingUsers, startTyping, stopTyping }
}

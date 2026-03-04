import { getClient } from '@matrix/client'
import { matrixEvents, sendTyping } from '@matrix/index'
import { onMounted, onUnmounted, ref } from 'vue'
import { useChatStore } from '../stores/chatStore'

export function useTyping() {
  const store = useChatStore()
  const typingUsers = ref<string[]>([])
  let typingTimer: ReturnType<typeof setTimeout> | null = null

  function onTypingEvent(payload: { roomId: string, userIds: string[] }) {
    if (payload.roomId === store.currentRoomId) {
      // 过滤掉当前用户自身
      const myUserId = getClient().getUserId()
      typingUsers.value = payload.userIds.filter(id => id !== myUserId)
    }
  }

  function startTyping() {
    const roomId = store.currentRoomId
    if (!roomId)
      return
    sendTyping(roomId, true, 5000).catch(() => {})
    if (typingTimer)
      clearTimeout(typingTimer)
    typingTimer = setTimeout(() => {
      sendTyping(roomId, false).catch(() => {})
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
    sendTyping(roomId, false).catch(() => {})
  }

  onMounted(() => {
    matrixEvents.on('room.typing', onTypingEvent)
  })

  onUnmounted(() => {
    matrixEvents.off('room.typing', onTypingEvent)
    // 卸载时发送停止输入通知，防止幽灵输入状态
    const roomId = store.currentRoomId
    if (roomId && typingTimer) {
      sendTyping(roomId, false).catch(() => {})
    }
    if (typingTimer)
      clearTimeout(typingTimer)
  })

  return { typingUsers, startTyping, stopTyping }
}

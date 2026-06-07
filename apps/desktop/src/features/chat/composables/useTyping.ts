import { getClient } from '@matrix/client'
import { matrixEvents } from '@matrix/index'
import { useSelector } from '@tanstack/vue-store'
import { Effect } from 'effect'
import { sendTypingEffect } from '@/matrix/typing'
import { runDesktopEffect } from '@/shared/lib/effect'
import { chatStore } from '../stores/chatStore'

export function useTyping() {
  const currentRoomId = useSelector(chatStore, (s) => s.currentRoomId)
  const typingUsers = ref<string[]>([])
  let typingTimer: ReturnType<typeof setTimeout> | null = null

  function onTypingEvent(payload: { roomId: string; userIds: string[] }) {
    if (payload.roomId === chatStore.state.currentRoomId) {
      // 过滤掉当前用户自身
      const myUserId = getClient().getUserId()
      typingUsers.value = payload.userIds.filter((id) => id !== myUserId)
    }
  }

  // 切换房间时清空上一会话残留的「正在输入」状态
  watch(currentRoomId, () => {
    typingUsers.value = []
  })

  function startTyping() {
    const roomId = chatStore.state.currentRoomId
    if (!roomId) return
    void runDesktopEffect(sendTypingEffect(roomId, true, 5000).pipe(Effect.catchAll(() => Effect.void)))
    if (typingTimer) clearTimeout(typingTimer)
    typingTimer = setTimeout(() => {
      void runDesktopEffect(sendTypingEffect(roomId, false).pipe(Effect.catchAll(() => Effect.void)))
    }, 3000)
  }

  function stopTyping() {
    const roomId = chatStore.state.currentRoomId
    if (!roomId) return
    if (typingTimer) {
      clearTimeout(typingTimer)
      typingTimer = null
    }
    void runDesktopEffect(sendTypingEffect(roomId, false).pipe(Effect.catchAll(() => Effect.void)))
  }

  onMounted(() => {
    matrixEvents.on('room.typing', onTypingEvent)
  })

  onUnmounted(() => {
    matrixEvents.off('room.typing', onTypingEvent)
    // 卸载时发送停止输入通知，防止幽灵输入状态
    const roomId = chatStore.state.currentRoomId
    if (roomId && typingTimer) {
      void runDesktopEffect(sendTypingEffect(roomId, false).pipe(Effect.catchAll(() => Effect.void)))
    }
    if (typingTimer) clearTimeout(typingTimer)
  })

  return { typingUsers, startTyping, stopTyping }
}

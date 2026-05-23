import { getClient } from '@matrix/client'
import { matrixEvents } from '@matrix/index'
import { Effect } from 'effect'
import { onMounted, onUnmounted, ref } from 'vue'
import { sendTypingEffect } from '@/matrix/typing'
import { runDesktopEffect } from '@/shared/lib/effect'
import { useChatStore } from '../stores/chatStore'

export function useTyping() {
  const store = useChatStore()
  const typingUsers = ref<string[]>([])
  let typingTimer: ReturnType<typeof setTimeout> | null = null

  function onTypingEvent(payload: { roomId: string; userIds: string[] }) {
    if (payload.roomId === store.currentRoomId) {
      // 过滤掉当前用户自身
      const myUserId = getClient().getUserId()
      typingUsers.value = payload.userIds.filter((id) => id !== myUserId)
    }
  }

  function startTyping() {
    const roomId = store.currentRoomId
    if (!roomId) return
    void runDesktopEffect(sendTypingEffect(roomId, true, 5000).pipe(Effect.catchAll(() => Effect.void)))
    if (typingTimer) clearTimeout(typingTimer)
    typingTimer = setTimeout(() => {
      void runDesktopEffect(sendTypingEffect(roomId, false).pipe(Effect.catchAll(() => Effect.void)))
    }, 3000)
  }

  function stopTyping() {
    const roomId = store.currentRoomId
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
    const roomId = store.currentRoomId
    if (roomId && typingTimer) {
      void runDesktopEffect(sendTypingEffect(roomId, false).pipe(Effect.catchAll(() => Effect.void)))
    }
    if (typingTimer) clearTimeout(typingTimer)
  })

  return { typingUsers, startTyping, stopTyping }
}

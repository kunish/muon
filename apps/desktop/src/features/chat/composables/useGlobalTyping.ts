import { matrixEvents } from '@matrix/index'
import { onMounted, onUnmounted, reactive } from 'vue'

/**
 * 全局 typing 状态 composable
 * 追踪所有房间的正在输入用户，供会话列表项使用
 */
const typingMap = reactive(new Map<string, string[]>())

let listenerCount = 0

function onTyping(payload: { roomId: string, userIds: string[] }) {
  if (payload.userIds.length > 0) {
    typingMap.set(payload.roomId, payload.userIds)
  }
  else {
    typingMap.delete(payload.roomId)
  }
}

export function useGlobalTyping() {
  onMounted(() => {
    if (listenerCount === 0) {
      matrixEvents.on('room.typing', onTyping)
    }
    listenerCount++
  })

  onUnmounted(() => {
    listenerCount--
    if (listenerCount === 0) {
      matrixEvents.off('room.typing', onTyping)
    }
  })

  function getTypingUsers(roomId: string): string[] {
    return typingMap.get(roomId) || []
  }

  return { getTypingUsers }
}

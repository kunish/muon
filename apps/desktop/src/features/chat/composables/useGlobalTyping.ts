import { getClient } from '@matrix/client'
import { matrixEvents } from '@matrix/index'
import { onMounted, onUnmounted, reactive } from 'vue'

/**
 * 全局 typing 状态 composable
 * 追踪所有房间的正在输入用户，供会话列表项使用
 */
const typingMap = reactive(new Map<string, string[]>())

let listenerCount = 0

function onTyping(payload: { roomId: string; userIds: string[] }) {
  // 过滤掉当前用户自身，避免在会话列表里显示「自己正在输入」
  const myUserId = getClient().getUserId()
  const others = payload.userIds.filter((id) => id !== myUserId)
  if (others.length > 0) {
    typingMap.set(payload.roomId, others)
  } else {
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

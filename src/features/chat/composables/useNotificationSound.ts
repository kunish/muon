import { getClient } from '@matrix/client'
import { matrixEvents } from '@matrix/index'
import { onMounted, onUnmounted } from 'vue'
import { playNotificationSound } from '@/shared/lib/audio'
import { useChatStore } from '../stores/chatStore'

/**
 * 监听新消息，在非当前会话收到消息时播放提示音
 */
export function useNotificationSound() {
  const store = useChatStore()

  function onNewMessage(payload: { roomId: string, event: any }) {
    const client = getClient()
    const myUserId = client.getUserId()

    // 不对自己发的消息播放提示音
    if (payload.event.getSender() === myUserId)
      return

    // 当前正在查看的房间不播放提示音
    if (payload.roomId === store.currentRoomId)
      return

    // 免打扰的房间不播放
    if (store.isMuted(payload.roomId))
      return

    playNotificationSound()
  }

  onMounted(() => {
    matrixEvents.on('room.message', onNewMessage)
  })

  onUnmounted(() => {
    matrixEvents.off('room.message', onNewMessage)
  })
}

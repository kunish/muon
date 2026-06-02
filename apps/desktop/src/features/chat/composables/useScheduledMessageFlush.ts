import { sendTextMessage } from '@matrix/index'
import { onMounted, onUnmounted } from 'vue'
import { useScheduledMessageStore } from '../stores/scheduledMessageStore'

const FLUSH_INTERVAL_MS = 15_000

/**
 * 到点发送已排程的消息。客户端态：仅在应用打开时轮询发送，发送成功才出队，
 * 失败留队下次重试（无服务端调度，属诚实限制）。在全局聊天页挂载一次即可。
 */
export function useScheduledMessageFlush(): void {
  const store = useScheduledMessageStore()
  let timer: ReturnType<typeof setInterval> | null = null
  let flushing = false

  async function flush(): Promise<void> {
    if (flushing) return
    const due = store.dueMessages(Date.now())
    if (due.length === 0) return
    flushing = true
    const sent: string[] = []
    try {
      for (const message of due) {
        try {
          await sendTextMessage(message.roomId, message.body, message.html)
          sent.push(message.id)
        } catch {
          // 发送失败：保留在队列，下个周期重试
        }
      }
    } finally {
      store.remove(sent)
      flushing = false
    }
  }

  onMounted(() => {
    void flush()
    timer = setInterval(() => void flush(), FLUSH_INTERVAL_MS)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })
}

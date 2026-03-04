import type { SyncState } from './types'
import { ref } from 'vue'
import { triggerPing } from '@/shared/composables/useNetworkStatus'
import { getClient } from './client'

export const syncState = ref<SyncState>('STOPPED')

let errorCount = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null

function scheduleRetry() {
  if (retryTimer)
    return
  errorCount++
  // 指数退避：2s, 4s, 8s, 16s, 最大 30s
  const delay = Math.min(2000 * 2 ** (errorCount - 1), 30_000)
  if (import.meta.env.DEV)
    console.debug(`[sync] 将在 ${delay}ms 后重试 (第 ${errorCount} 次失败)`)

  retryTimer = setTimeout(() => {
    retryTimer = null
    try {
      const client = getClient()
      client.retryImmediately()
    }
    catch {
      // client 可能已销毁
    }
  }, delay)
}

export function startSync(): void {
  const client = getClient()
  errorCount = 0

  client.on('sync' as any, (state: string) => {
    switch (state) {
      case 'PREPARED':
        syncState.value = 'PREPARED'
        errorCount = 0
        break
      case 'SYNCING':
        syncState.value = 'SYNCING'
        errorCount = 0
        break
      case 'ERROR':
        syncState.value = 'ERROR'
        // 通知网络状态检测立即 ping
        triggerPing()
        // 安排指数退避重试
        scheduleRetry()
        break
      default:
        break
    }
  })

  client.startClient({ initialSyncLimit: 20 })
}

export function stopSync(): void {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  errorCount = 0
  getClient().stopClient()
  syncState.value = 'STOPPED'
}

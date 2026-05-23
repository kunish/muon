import type { SyncState } from './types'
import { ClientEvent } from 'matrix-js-sdk'
import { ref } from 'vue'
import { triggerPing } from '@/shared/composables/useNetworkStatus'
import { getClient } from './client'
import { matrixEvents } from './events'

export const syncState = ref<SyncState>('STOPPED')

let errorCount = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null

function applySyncState(state: SyncState) {
  syncState.value = state
  matrixEvents.emit('sync.state', { state })
}

function scheduleRetry() {
  if (retryTimer)
    return
  errorCount++
  // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
  const delay = Math.min(2000 * 2 ** (errorCount - 1), 30_000)
  if (import.meta.env.DEV)
    // eslint-disable-next-line no-console
    console.debug(`[sync] retrying in ${delay}ms (attempt ${errorCount})`)
  retryTimer = setTimeout(() => {
    retryTimer = null
    try {
      const client = getClient()
      client.retryImmediately()
    }
    catch {
      // Client may have been destroyed
    }
  }, delay)
}

export function startSync(): void {
  const client = getClient()
  errorCount = 0

  client.on(ClientEvent.Sync, (state: SyncState) => {
    switch (state) {
      case 'RECONNECTING':
        applySyncState('RECONNECTING')
        break
      case 'CATCHUP':
        applySyncState('CATCHUP')
        break
      case 'PREPARED':
        applySyncState('PREPARED')
        errorCount = 0
        break
      case 'SYNCING':
        applySyncState('SYNCING')
        errorCount = 0
        break
      case 'ERROR':
        applySyncState('ERROR')
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
  applySyncState('STOPPED')
}

import type { SyncState } from './types'
import { ref } from 'vue'
import { getClient } from './client'

export const syncState = ref<SyncState>('STOPPED')

export function startSync(): void {
  const client = getClient()

  client.on('sync' as any, (state: string) => {
    switch (state) {
      case 'PREPARED':
        syncState.value = 'PREPARED'
        break
      case 'SYNCING':
        syncState.value = 'SYNCING'
        break
      case 'ERROR':
        syncState.value = 'ERROR'
        break
      default:
        break
    }
  })

  client.startClient({ initialSyncLimit: 20 })
}

export function stopSync(): void {
  getClient().stopClient()
  syncState.value = 'STOPPED'
}

import { Doc } from 'yjs'
import { shallowRef, onUnmounted } from 'vue'
import { MatrixSyncProvider } from '../services/matrixSyncProvider'
import { getClient } from '@matrix/client'
import type { MatrixClient } from 'matrix-js-sdk'

export function useDocSync(docId: string) {
  const ydoc = shallowRef(new Doc())
  const provider = shallowRef<MatrixSyncProvider | null>(null)
  const connected = shallowRef(false)
  const error = shallowRef<string | null>(null)

  async function connect(): Promise<void> {
    try {
      const client: MatrixClient = getClient()

      let room = client.getRoom(docId)
      if (!room) {
        const result = await client.joinRoom(docId)
        room = client.getRoom(result.roomId)!
      }

      provider.value = new MatrixSyncProvider(ydoc.value, room.roomId, client)
      connected.value = true
      error.value = null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to connect'
      connected.value = false
    }
  }

  function disconnect(): void {
    provider.value?.destroy()
    provider.value = null
    connected.value = false
  }

  onUnmounted(() => {
    disconnect()
  })

  return { ydoc, provider, connected, error, connect, disconnect }
}

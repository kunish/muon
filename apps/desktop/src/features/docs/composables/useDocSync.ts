import type { MatrixClient } from 'matrix-js-sdk'
import { getClient } from '@matrix/client'
import { onUnmounted, shallowRef } from 'vue'
import { Doc } from 'yjs'
import { MatrixSyncProvider } from '../services/matrixSyncProvider'

interface MatrixJoinRoomResult {
  roomId?: string
  room_id?: string
}

export function useDocSync(docId: string) {
  const ydoc = shallowRef(new Doc())
  const provider = shallowRef<MatrixSyncProvider | null>(null)
  const connected = shallowRef(false)
  const error = shallowRef<string | null>(null)

  async function connect(): Promise<void> {
    try {
      const client: MatrixClient = getClient()

      const cachedRoom = client.getRoom(docId)
      let roomId = cachedRoom?.roomId ?? docId
      if (!cachedRoom) {
        const result = (await client.joinRoom(docId)) as MatrixJoinRoomResult
        roomId = result.roomId ?? result.room_id ?? docId
        roomId = client.getRoom(roomId)?.roomId ?? roomId
      }

      provider.value = new MatrixSyncProvider(ydoc.value, roomId, client)
      provider.value.sendSnapshot()
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

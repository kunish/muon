import type { MatrixSyncProvider } from '../services/matrixSyncProvider'
import type { CursorData } from '../types/doc'
import { userColor } from '../types/doc'

export function useDocCursor(provider: () => MatrixSyncProvider | null, userId: string, userName: string) {
  const remoteCursors = shallowRef<Record<string, CursorData>>({})
  const color = userColor(userId)

  function updateLocalCursor(from: number, to: number): void {
    provider()?.sendCursor({ userId, name: userName, color, from, to })
  }

  const others = computed(() => Object.values(remoteCursors.value).filter((c) => c.userId !== userId))

  function updateRemoteCursor(cursor: CursorData): void {
    remoteCursors.value = { ...remoteCursors.value, [cursor.userId]: cursor }
  }

  function removeRemoteCursor(targetUserId: string): void {
    const updated = { ...remoteCursors.value }
    delete updated[targetUserId]
    remoteCursors.value = updated
  }

  watchEffect((onCleanup) => {
    const currentProvider = provider()
    if (!currentProvider) return

    const dispose = currentProvider.onCursor(updateRemoteCursor)
    onCleanup(dispose)
  })

  return { color, remoteCursors, others, updateLocalCursor, updateRemoteCursor, removeRemoteCursor }
}

import { getClient } from '@/matrix/client'

/**
 * Check if a room is a direct message (DM) room.
 * Inspects the user's m.direct account data.
 */
export function isDirectRoom(roomId: string): boolean {
  const client = getClient()
  const directEvent = client.getAccountData('m.direct' as any)
  const directContent: Record<string, string[]> = directEvent?.getContent() ?? {}
  return Object.values(directContent).some(
    ids => Array.isArray(ids) && ids.includes(roomId),
  )
}

export function normalizeRoomId(id: string | null | undefined): string | null {
  if (!id)
    return null
  try {
    return decodeURIComponent(id)
  }
  catch {
    return id
  }
}

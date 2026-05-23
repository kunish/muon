import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { fromSync, runDesktopSync } from '@/shared/lib/effect'
import { getClient } from './client'

/**
 * Check if a room is a direct message (DM) room.
 * Inspects the user's m.direct account data.
 */
export function isDirectRoomEffect(roomId: string): DesktopEffect<boolean> {
  return fromSync(() => {
    const client = getClient()
    const directEvent = client.getAccountData('m.direct')
    const directContent: Record<string, string[]> = directEvent?.getContent() ?? {}
    return Object.values(directContent).some((ids) => Array.isArray(ids) && ids.includes(roomId))
  })
}

export function isDirectRoom(roomId: string): boolean {
  return runDesktopSync(isDirectRoomEffect(roomId))
}

export function normalizeRoomIdEffect(id: string | null | undefined): DesktopEffect<string | null> {
  return fromSync(() => {
    if (!id) return null
    return decodeURIComponent(id)
  }).pipe(Effect.catchAll(() => Effect.succeed(id ?? null)))
}

export function normalizeRoomId(id: string | null | undefined): string | null {
  return runDesktopSync(normalizeRoomIdEffect(id))
}

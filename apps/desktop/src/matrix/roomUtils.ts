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

export interface DirectRoomPeer {
  userId: string
  displayName: string
}

/** Resolve the other participant of a 1:1 room (the member that is not the current user). */
export function getDirectRoomPeer(roomId: string): DirectRoomPeer | null {
  const client = getClient()
  const room = client.getRoom(roomId)
  if (!room) return null

  const selfId = client.getUserId()
  const peer =
    room.getJoinedMembers().find((member) => member.userId !== selfId) ??
    room.getMembers().find((member) => member.userId !== selfId)
  if (!peer) return null

  return {
    userId: peer.userId,
    displayName: peer.name || peer.userId.split(':')[0]?.replace(/^@/, '') || peer.userId,
  }
}

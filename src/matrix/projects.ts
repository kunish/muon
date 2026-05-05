import type { MatrixEvent } from 'matrix-js-sdk'
import type { ProjectSyncPayload } from '@/features/projects/types'
import { EventType } from 'matrix-js-sdk'
import { getClient } from './client'

const SYNC_EVENT_TYPE = EventType.RoomMessage

export async function sendProjectSyncEvent(
  roomId: string,
  payload: ProjectSyncPayload,
): Promise<void> {
  const client = getClient()
  await client.sendEvent(roomId, SYNC_EVENT_TYPE, {
    msgtype: 'muon.project.sync',
    body: JSON.stringify(payload),
  })
}

export function isProjectSyncEvent(event: MatrixEvent): boolean {
  const content = event.getContent()
  return content.msgtype === 'muon.project.sync'
}

export function parseProjectSyncPayload(event: MatrixEvent): ProjectSyncPayload | null {
  try {
    const content = event.getContent<{ body: string }>()
    return JSON.parse(content.body) as ProjectSyncPayload
  }
  catch {
    return null
  }
}

import type { MatrixEvent } from 'matrix-js-sdk'
import type { ProjectSyncPayload } from '@/features/projects/types'
import { getClient } from './client'

const SYNC_EVENT_TYPE = 'muon.project.sync'
interface ProjectSyncClient {
  sendEvent: (roomId: string, eventType: string, content: ProjectSyncPayload) => Promise<unknown>
}

export async function sendProjectSyncEvent(
  roomId: string,
  payload: ProjectSyncPayload,
): Promise<void> {
  const client = getClient()
  await (client as unknown as ProjectSyncClient).sendEvent(roomId, SYNC_EVENT_TYPE, payload)
}

export function isProjectSyncEvent(event: MatrixEvent): boolean {
  return event.getType() === SYNC_EVENT_TYPE
}

export function parseProjectSyncPayload(event: MatrixEvent): ProjectSyncPayload | null {
  try {
    return event.getContent<ProjectSyncPayload>()
  }
  catch {
    return null
  }
}

import type { MatrixEvent } from 'matrix-js-sdk'
import type { ProjectSyncPayload } from '@/features/projects/types'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'
import { getClient } from './client'

const SYNC_EVENT_TYPE = 'muon.project.sync'
interface ProjectSyncClient {
  sendEvent: (roomId: string, eventType: string, content: ProjectSyncPayload) => Promise<unknown>
}

export function sendProjectSyncEventEffect(roomId: string, payload: ProjectSyncPayload): DesktopEffect<void> {
  return fromPromise(() =>
    (getClient() as unknown as ProjectSyncClient).sendEvent(roomId, SYNC_EVENT_TYPE, payload),
  ).pipe(Effect.asVoid)
}

export function sendProjectSyncEvent(roomId: string, payload: ProjectSyncPayload): Promise<void> {
  return runDesktopEffect(sendProjectSyncEventEffect(roomId, payload))
}

export function isProjectSyncEventEffect(event: MatrixEvent): DesktopEffect<boolean> {
  return fromSync(() => event.getType() === SYNC_EVENT_TYPE)
}

export function isProjectSyncEvent(event: MatrixEvent): boolean {
  return runDesktopSync(isProjectSyncEventEffect(event))
}

export function parseProjectSyncPayloadEffect(event: MatrixEvent): DesktopEffect<ProjectSyncPayload | null> {
  return fromSync(() => event.getContent<ProjectSyncPayload>()).pipe(Effect.catchAll(() => Effect.succeed(null)))
}

export function parseProjectSyncPayload(event: MatrixEvent): ProjectSyncPayload | null {
  return runDesktopSync(parseProjectSyncPayloadEffect(event))
}

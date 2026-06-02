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

// --- 工作项评论（挂在项目 Matrix 房间上，按 workItemId 归属） ---

const COMMENT_EVENT_TYPE = 'muon.project.workitem.comment'

export interface WorkItemComment {
  id: string
  workItemId: string
  sender: string
  body: string
  ts: number
}

interface WorkItemCommentClient {
  sendEvent: (roomId: string, eventType: string, content: Record<string, unknown>) => Promise<unknown>
}

export function sendWorkItemCommentEffect(projectId: string, workItemId: string, body: string): DesktopEffect<void> {
  return fromPromise(() => {
    const client = getClient()
    return (client as unknown as WorkItemCommentClient).sendEvent(projectId, COMMENT_EVENT_TYPE, {
      workItemId,
      body,
      ts: Date.now(),
      sender: client.getUserId() ?? '',
    })
  }).pipe(Effect.asVoid)
}

export function sendWorkItemComment(projectId: string, workItemId: string, body: string): Promise<void> {
  return runDesktopEffect(sendWorkItemCommentEffect(projectId, workItemId, body))
}

export function isWorkItemCommentEvent(event: MatrixEvent): boolean {
  return runDesktopSync(fromSync(() => event.getType() === COMMENT_EVENT_TYPE))
}

function parseWorkItemComment(event: MatrixEvent): WorkItemComment | null {
  const content = event.getContent() as { workItemId?: unknown; body?: unknown; ts?: unknown; sender?: unknown }
  if (typeof content.workItemId !== 'string' || typeof content.body !== 'string') return null
  return {
    id: event.getId() ?? `${content.workItemId}:${String(content.ts ?? '')}`,
    workItemId: content.workItemId,
    sender: typeof content.sender === 'string' && content.sender ? content.sender : (event.getSender() ?? ''),
    body: content.body,
    ts: typeof content.ts === 'number' ? content.ts : event.getTs(),
  }
}

/** 读取某工作项的全部评论（来自项目房间已加载的时间线，按时间升序） */
export function getWorkItemComments(projectId: string, workItemId: string): WorkItemComment[] {
  return runDesktopSync(
    fromSync(() => {
      const room = getClient().getRoom(projectId)
      if (!room) return []
      return room
        .getLiveTimeline()
        .getEvents()
        .filter((event) => event.getType() === COMMENT_EVENT_TYPE)
        .map(parseWorkItemComment)
        .filter((comment): comment is WorkItemComment => comment !== null && comment.workItemId === workItemId)
        .sort((a, b) => a.ts - b.ts)
    }),
  )
}

import { NotificationCountType } from 'matrix-js-sdk'
import { vi } from 'vitest'

export interface MockMatrixEventOptions {
  eventId: string
  ts: number
  body?: string
  sender?: string
  type?: string
  msgtype?: string
}

export function createMatrixEvent(options: MockMatrixEventOptions) {
  const {
    eventId,
    ts,
    body = eventId,
    sender = '@alice:example.com',
    type = 'm.room.message',
    msgtype = 'm.text',
  } = options

  return {
    getId: () => eventId,
    getTs: () => ts,
    getType: () => type,
    getSender: () => sender,
    getContent: () => ({ body, msgtype }),
  } as any
}

export function createTimeline(events: any[]) {
  return {
    getEvents: vi.fn(() => events),
  } as any
}

export interface MockRecoveryRoomOptions {
  roomId: string
  name: string
  timelineEvents?: any[]
  liveTimelineEvents?: any[]
  unreadCount?: number
  highlightCount?: number
  joinedMembers?: string[]
}

export function createRecoveryRoom(options: MockRecoveryRoomOptions) {
  const {
    roomId,
    name,
    timelineEvents = [],
    liveTimelineEvents = timelineEvents,
    unreadCount = 1,
    highlightCount = 0,
    joinedMembers = ['@self:localhost', '@alice:example.com'],
  } = options

  const members = joinedMembers.map(userId => ({
    userId,
    name: userId === '@self:localhost' ? 'Self User' : userId.split(':')[0]?.slice(1),
    getMxcAvatarUrl: () => null,
  }))

  return {
    roomId,
    name,
    timeline: timelineEvents,
    tags: {},
    getMyMembership: () => 'join',
    getJoinedMembers: () => members,
    getJoinedMemberCount: () => members.length,
    getMember: (userId: string) => members.find(member => member.userId === userId) ?? null,
    getMxcAvatarUrl: () => null,
    getUnreadNotificationCount: (type: NotificationCountType) => {
      if (type === NotificationCountType.Highlight)
        return highlightCount
      return unreadCount
    },
    getLiveTimeline: vi.fn(() => createTimeline(liveTimelineEvents)),
  } as any
}

export function createSyncLifecycleRecorder() {
  let syncListener: ((state: string) => void) | null = null

  return {
    bind(on: (event: string, callback: (...args: any[]) => void) => void) {
      on('sync', (state: string) => {
        syncListener?.(state)
      })
    },
    capture(callback: (state: string) => void) {
      syncListener = callback
    },
    emit(state: string) {
      syncListener?.(state)
    },
  }
}

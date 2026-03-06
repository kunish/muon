export interface MockSearchResultEntry {
  rank: number
  result: {
    room_id: string
    event_id: string
    sender: string
    origin_server_ts: number
    content?: {
      body?: string
    }
  }
}

export interface MockSearchPayload {
  count: number
  results: MockSearchResultEntry[]
  highlights: string[]
  next_batch?: string
}

export function createMixedMembershipRooms() {
  return [
    { roomId: '!joined-alpha:localhost', getMyMembership: () => 'join' },
    { roomId: '!left-gamma:localhost', getMyMembership: () => 'leave' },
    { roomId: '!joined-beta:localhost', getMyMembership: () => 'join' },
    { roomId: '!invite-delta:localhost', getMyMembership: () => 'invite' },
  ]
}

export function createSearchPageOne(): MockSearchPayload {
  return {
    count: 3,
    highlights: ['release'],
    next_batch: 'token-page-2',
    results: [
      {
        rank: 0.99,
        result: {
          room_id: '!joined-alpha:localhost',
          event_id: '$evt-1',
          sender: '@alice:localhost',
          origin_server_ts: 1700000000100,
          content: { body: 'release checklist ready' },
        },
      },
      {
        rank: 0.93,
        result: {
          room_id: '!joined-beta:localhost',
          event_id: '$evt-2',
          sender: '@bob:localhost',
          origin_server_ts: 1700000000200,
          content: { body: 'release blockers reviewed' },
        },
      },
    ],
  }
}

export function createSearchPageTwo(): MockSearchPayload {
  return {
    count: 3,
    highlights: ['release'],
    results: [
      {
        rank: 0.93,
        result: {
          room_id: '!joined-beta:localhost',
          event_id: '$evt-2',
          sender: '@bob:localhost',
          origin_server_ts: 1700000000200,
          content: { body: 'release blockers reviewed' },
        },
      },
      {
        rank: 0.88,
        result: {
          room_id: '!joined-alpha:localhost',
          event_id: '$evt-3',
          sender: '@charlie:localhost',
          origin_server_ts: 1700000000300,
          content: { body: 'release retro scheduled' },
        },
      },
    ],
  }
}

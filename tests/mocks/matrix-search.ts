/** Mock search result entry matching SearchResult class shape (context.getEvent()) */
function mockSearchResult(opts: {
  rank: number
  room_id: string
  event_id: string
  sender: string
  origin_server_ts: number
  body?: string
}) {
  return {
    rank: opts.rank,
    context: {
      getEvent() {
        return {
          getRoomId: () => opts.room_id,
          getId: () => opts.event_id,
          getSender: () => opts.sender,
          getTs: () => opts.origin_server_ts,
          getContent: () => ({ body: opts.body ?? '' }),
        }
      },
    },
  }
}

export function createMixedMembershipRooms() {
  return [
    { roomId: '!joined-alpha:localhost', getMyMembership: () => 'join' },
    { roomId: '!left-gamma:localhost', getMyMembership: () => 'leave' },
    { roomId: '!joined-beta:localhost', getMyMembership: () => 'join' },
    { roomId: '!invite-delta:localhost', getMyMembership: () => 'invite' },
  ]
}

export function createSearchPageOne() {
  return {
    count: 3,
    highlights: ['release'],
    next_batch: 'token-page-2',
    results: [
      mockSearchResult({
        rank: 0.99,
        room_id: '!joined-alpha:localhost',
        event_id: '$evt-1',
        sender: '@alice:localhost',
        origin_server_ts: 1700000000100,
        body: 'release checklist ready',
      }),
      mockSearchResult({
        rank: 0.93,
        room_id: '!joined-beta:localhost',
        event_id: '$evt-2',
        sender: '@bob:localhost',
        origin_server_ts: 1700000000200,
        body: 'release blockers reviewed',
      }),
    ],
  }
}

export function createSearchPageTwo() {
  return {
    count: 3,
    highlights: ['release'],
    results: [
      mockSearchResult({
        rank: 0.93,
        room_id: '!joined-beta:localhost',
        event_id: '$evt-2',
        sender: '@bob:localhost',
        origin_server_ts: 1700000000200,
        body: 'release blockers reviewed',
      }),
      mockSearchResult({
        rank: 0.88,
        room_id: '!joined-alpha:localhost',
        event_id: '$evt-3',
        sender: '@charlie:localhost',
        origin_server_ts: 1700000000300,
        body: 'release retro scheduled',
      }),
    ],
  }
}

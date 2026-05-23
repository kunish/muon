import type { ISearchResults } from 'matrix-js-sdk'
import type { SearchResult } from 'matrix-js-sdk/lib/models/search-result'
import { getClient } from './client'

export interface RetrievalItem {
  roomId: string
  eventId: string
  body: string
  sender: string
  ts: number
  rank: number
}

export interface RetrievalSession {
  term: string
  searchResults: ISearchResults
  items: RetrievalItem[]
  seenEventIds: Set<string>
  allowedRoomIds: Set<string>
}

export interface RetrievalPage {
  items: RetrievalItem[]
  nextBatch: string | null
  canPaginate: boolean
  session: RetrievalSession | null
}

export async function searchRoomEvents(term: string, limit = 20): Promise<RetrievalPage> {
  const normalizedTerm = term.trim()
  if (!normalizedTerm) {
    return {
      items: [],
      nextBatch: null,
      canPaginate: false,
      session: null,
    }
  }

  const client = getClient()
  const joinedRoomIds: string[] = client.getRooms()
    .filter(room => room.getMyMembership() === 'join')
    .map(room => room.roomId)
    .filter((roomId): roomId is string => typeof roomId === 'string' && roomId.length > 0)

  if (joinedRoomIds.length === 0) {
    return {
      items: [],
      nextBatch: null,
      canPaginate: false,
      session: null,
    }
  }

  const searchResults = await client.searchRoomEvents({
    term: normalizedTerm,
    filter: { rooms: joinedRoomIds, limit },
  })

  const allowedRoomIds = new Set(joinedRoomIds)
  const items = mapSearchResults(searchResults?.results, allowedRoomIds)
  const seenEventIds = new Set(items.map(item => item.eventId))

  const session: RetrievalSession = {
    term: normalizedTerm,
    searchResults,
    items,
    seenEventIds,
    allowedRoomIds,
  }

  return {
    items,
    nextBatch: getNextBatch(searchResults),
    canPaginate: hasNextBatch(searchResults),
    session,
  }
}

export async function backPaginateRoomEventsSearch(session: RetrievalSession): Promise<RetrievalPage> {
  const nextBatch = getNextBatch(session.searchResults)
  if (!nextBatch) {
    return {
      items: [...session.items],
      nextBatch: null,
      canPaginate: false,
      session,
    }
  }

  const client = getClient()
  await client.backPaginateRoomEventsSearch(session.searchResults)

  const paginatedItems = mapSearchResults(session.searchResults?.results, session.allowedRoomIds)
  const appended: RetrievalItem[] = []
  for (const item of paginatedItems) {
    if (session.seenEventIds.has(item.eventId))
      continue
    session.seenEventIds.add(item.eventId)
    appended.push(item)
  }

  if (appended.length > 0)
    session.items = [...session.items, ...appended]

  return {
    items: [...session.items],
    nextBatch: getNextBatch(session.searchResults),
    canPaginate: hasNextBatch(session.searchResults),
    session,
  }
}

function mapSearchResults(results: SearchResult[] | undefined, allowedRoomIds: Set<string>): RetrievalItem[] {
  if (!Array.isArray(results))
    return []

  const mapped: RetrievalItem[] = []
  for (const entry of results) {
    const event = entry.context.getEvent()
    const roomId = event.getRoomId()
    const eventId = event.getId()
    if (!roomId || !eventId)
      continue
    if (!allowedRoomIds.has(roomId))
      continue

    mapped.push({
      roomId,
      eventId,
      body: event.getContent()?.body ?? '',
      sender: event.getSender() ?? '',
      ts: event.getTs() ?? 0,
      rank: entry.rank ?? 0,
    })
  }

  return mapped
}

function getNextBatch(searchResults: ISearchResults): string | null {
  const token = searchResults.next_batch
  return typeof token === 'string' && token.length > 0 ? token : null
}

function hasNextBatch(searchResults: ISearchResults): boolean {
  return getNextBatch(searchResults) !== null
}

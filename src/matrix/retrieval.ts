import type { ISearchResults } from 'matrix-js-sdk'
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

  void limit
  void getClient
  throw new Error('searchRoomEvents is not implemented yet')
}

export async function backPaginateRoomEventsSearch(_session: RetrievalSession): Promise<RetrievalPage> {
  throw new Error('backPaginateRoomEventsSearch is not implemented yet')
}

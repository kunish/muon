import Dexie, { type EntityTable } from 'dexie'
import type {
  CrossSessionQaAnswer,
  DecisionCard,
  DigestEntry,
  SuggestionDisposition,
} from '@/features/chat/types/knowledge'

export const KNOWLEDGE_DB_NAME = 'MuonKnowledgeDB'

export const KNOWLEDGE_DB_STORES = {
  digestEntries: 'id, sessionId, relevance, createdAt, updatedAt, *citationEventIds',
  decisions: 'id, status, owner, createdAt, updatedAt, *citationEventIds',
  qaSessions: 'id, createdAt, updatedAt, *citationEventIds',
} as const

export class MuonKnowledgeDB extends Dexie {
  digestEntries!: EntityTable<DigestEntry, 'id'>
  decisions!: EntityTable<DecisionCard, 'id'>
  qaSessions!: EntityTable<CrossSessionQaAnswer, 'id'>

  constructor() {
    super(KNOWLEDGE_DB_NAME)
    this.version(1).stores(KNOWLEDGE_DB_STORES)
  }
}

export const knowledgeDb = new MuonKnowledgeDB()

export function createKnowledgeRepository() {
  return {
    async listDigestEntries(_relevance?: DigestEntry['relevance']) {
      throw new Error('Not implemented')
    },
    async listDecisionCards(_status?: DecisionCard['status']) {
      throw new Error('Not implemented')
    },
    async listQaSessions() {
      throw new Error('Not implemented')
    },
    async updateSuggestionDisposition(_decisionId: string, _suggestionId: string, _disposition: SuggestionDisposition) {
      throw new Error('Not implemented')
    },
  }
}

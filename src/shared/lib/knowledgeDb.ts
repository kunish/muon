import Dexie, { type EntityTable } from 'dexie'
import type {
  CrossSessionQaAnswer,
  DecisionCard,
  DigestEntry,
  SuggestionDisposition,
} from '@/features/chat/types/knowledge'
import {
  crossSessionQaAnswerSchema,
  decisionCardSchema,
  digestEntrySchema,
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

type CollectionLike<T> = {
  toArray: () => Promise<T[]>
}

type WhereClauseLike<T> = {
  equals: (value: unknown) => CollectionLike<T>
}

type OrderByClauseLike<T> = {
  reverse: () => CollectionLike<T>
}

type KnowledgeTable<T extends { id: string }> = {
  put: (value: T) => Promise<string | number>
  get: (id: string) => Promise<T | undefined>
  update: (id: string, changes: Partial<T>) => Promise<number>
  where: (index: string) => WhereClauseLike<T>
  orderBy: (index: string) => OrderByClauseLike<T>
}

export interface KnowledgeRepositoryTables {
  digestEntries: KnowledgeTable<DigestEntry>
  decisions: KnowledgeTable<DecisionCard>
  qaSessions: KnowledgeTable<CrossSessionQaAnswer>
}

export function createKnowledgeRepository(db: KnowledgeRepositoryTables = knowledgeDb as unknown as KnowledgeRepositoryTables) {
  return {
    async saveDigestEntry(entry: DigestEntry) {
      const parsed = digestEntrySchema.parse(entry)
      await db.digestEntries.put(parsed)
      return parsed
    },
    async saveDecisionCard(card: DecisionCard) {
      const parsed = decisionCardSchema.parse(card)
      await db.decisions.put(parsed)
      return parsed
    },
    async saveQaSession(answer: CrossSessionQaAnswer) {
      const parsed = crossSessionQaAnswerSchema.parse(answer)
      await db.qaSessions.put(parsed)
      return parsed
    },
    async listDigestEntries(relevance?: DigestEntry['relevance']) {
      if (relevance)
        return await db.digestEntries.where('relevance').equals(relevance).toArray()

      return await db.digestEntries.orderBy('createdAt').reverse().toArray()
    },
    async listDecisionCards(status?: DecisionCard['status']) {
      if (status)
        return await db.decisions.where('status').equals(status).toArray()

      return await db.decisions.orderBy('updatedAt').reverse().toArray()
    },
    async listQaSessions() {
      return await db.qaSessions.orderBy('createdAt').reverse().toArray()
    },
    async updateSuggestionDisposition(decisionId: string, suggestionId: string, disposition: SuggestionDisposition, updatedBy = 'system', updatedAt = Date.now()) {
      const decision = await db.decisions.get(decisionId)
      if (!decision)
        throw new Error(`Decision ${decisionId} not found`)

      const suggestions = decision.suggestions.map((suggestion) => {
        if (suggestion.id !== suggestionId)
          return suggestion

        return {
          ...suggestion,
          disposition,
          updatedAt,
          updatedBy,
        }
      })

      const nextDecision = decisionCardSchema.parse({
        ...decision,
        suggestions,
        updatedAt,
      })

      await db.decisions.update(decisionId, nextDecision)
      return nextDecision
    },
  }
}

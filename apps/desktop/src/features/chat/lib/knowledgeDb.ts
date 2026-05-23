import type { EntityTable } from 'dexie'
import type { CrossSessionQaAnswer, DecisionCard, DigestEntry, SuggestionDisposition } from '../types/knowledge'
import type { DesktopEffect } from '@/shared/lib/effect'
import Dexie from 'dexie'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { crossSessionQaAnswerSchema, decisionCardSchema, digestEntrySchema } from '../types/knowledge'

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

interface CollectionLike<T> {
  toArray: () => Promise<T[]>
}

interface WhereClauseLike<T> {
  equals: (value: unknown) => CollectionLike<T>
}

interface OrderByClauseLike<T> {
  reverse: () => CollectionLike<T>
}

interface KnowledgeTable<T extends { id: string }> {
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

export function createKnowledgeRepository(
  db: KnowledgeRepositoryTables = knowledgeDb as unknown as KnowledgeRepositoryTables,
) {
  const saveDigestEntryEffect = (entry: DigestEntry): DesktopEffect<DigestEntry> =>
    Effect.gen(function* () {
      const parsed = digestEntrySchema.parse(entry)
      yield* fromPromise(() => db.digestEntries.put(parsed))
      return parsed
    })

  const saveDecisionCardEffect = (card: DecisionCard): DesktopEffect<DecisionCard> =>
    Effect.gen(function* () {
      const parsed = decisionCardSchema.parse(card)
      yield* fromPromise(() => db.decisions.put(parsed))
      return parsed
    })

  const saveQaSessionEffect = (answer: CrossSessionQaAnswer): DesktopEffect<CrossSessionQaAnswer> =>
    Effect.gen(function* () {
      const parsed = crossSessionQaAnswerSchema.parse(answer)
      yield* fromPromise(() => db.qaSessions.put(parsed))
      return parsed
    })

  const listDigestEntriesEffect = (relevance?: DigestEntry['relevance']): DesktopEffect<DigestEntry[]> => {
    if (relevance) return fromPromise(() => db.digestEntries.where('relevance').equals(relevance).toArray())

    return fromPromise(() => db.digestEntries.orderBy('createdAt').reverse().toArray())
  }

  const listDecisionCardsEffect = (status?: DecisionCard['status']): DesktopEffect<DecisionCard[]> => {
    if (status) return fromPromise(() => db.decisions.where('status').equals(status).toArray())

    return fromPromise(() => db.decisions.orderBy('updatedAt').reverse().toArray())
  }

  const listQaSessionsEffect = (): DesktopEffect<CrossSessionQaAnswer[]> =>
    fromPromise(() => db.qaSessions.orderBy('createdAt').reverse().toArray())

  const updateSuggestionDispositionEffect = (
    decisionId: string,
    suggestionId: string,
    disposition: SuggestionDisposition,
    updatedBy = 'system',
    updatedAt = Date.now(),
  ): DesktopEffect<DecisionCard> =>
    Effect.gen(function* () {
      const decision = yield* fromPromise(() => db.decisions.get(decisionId))
      if (!decision) {
        return yield* fromSync(() => {
          throw new Error(`Decision ${decisionId} not found`)
        })
      }

      const suggestions = decision.suggestions.map((suggestion) => {
        if (suggestion.id !== suggestionId) return suggestion

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

      yield* fromPromise(() => db.decisions.update(decisionId, nextDecision))
      return nextDecision
    })

  return {
    saveDigestEntryEffect,
    saveDecisionCardEffect,
    saveQaSessionEffect,
    listDigestEntriesEffect,
    listDecisionCardsEffect,
    listQaSessionsEffect,
    updateSuggestionDispositionEffect,
    saveDigestEntry(entry: DigestEntry) {
      return runDesktopEffect(saveDigestEntryEffect(entry))
    },
    saveDecisionCard(card: DecisionCard) {
      return runDesktopEffect(saveDecisionCardEffect(card))
    },
    saveQaSession(answer: CrossSessionQaAnswer) {
      return runDesktopEffect(saveQaSessionEffect(answer))
    },
    listDigestEntries(relevance?: DigestEntry['relevance']) {
      return runDesktopEffect(listDigestEntriesEffect(relevance))
    },
    listDecisionCards(status?: DecisionCard['status']) {
      return runDesktopEffect(listDecisionCardsEffect(status))
    },
    listQaSessions() {
      return runDesktopEffect(listQaSessionsEffect())
    },
    updateSuggestionDisposition(
      decisionId: string,
      suggestionId: string,
      disposition: SuggestionDisposition,
      updatedBy = 'system',
      updatedAt = Date.now(),
    ) {
      return runDesktopEffect(
        updateSuggestionDispositionEffect(decisionId, suggestionId, disposition, updatedBy, updatedAt),
      )
    },
  }
}

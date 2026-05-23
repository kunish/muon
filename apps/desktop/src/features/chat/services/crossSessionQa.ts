import type { DesktopEffect } from '@/shared/lib/effect'
import { createKnowledgeRepository } from '@features/chat/lib/knowledgeDb'
import { Effect } from 'effect'
import { searchRoomEvents } from '@/matrix/retrieval'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { crossSessionQaAnswerSchema, toCitationEventIds } from '../types/knowledge'

const repository = createKnowledgeRepository()

export function askCrossSessionQuestionEffect(
  question: string,
  limit = 5,
): DesktopEffect<ReturnType<typeof crossSessionQaAnswerSchema.parse>> {
  return Effect.gen(function* () {
    const normalizedQuestion = question.trim()
    if (!normalizedQuestion) {
      return yield* fromSync(() => {
        throw new Error('Question is required')
      })
    }

    const page = yield* fromPromise(() => searchRoomEvents(normalizedQuestion, limit))
    if (!page.items.length) {
      return yield* fromSync(() => {
        throw new Error('No cited answer available')
      })
    }

    const evidence = page.items.slice(0, 3)
    const citations = evidence.map((item) => ({
      roomId: item.roomId,
      eventId: item.eventId,
      quote: item.body,
    }))

    const answer = crossSessionQaAnswerSchema.parse({
      id: `qa:${Date.now()}`,
      question: normalizedQuestion,
      answer: evidence.map((item) => item.body).join(' '),
      citations,
      citationEventIds: toCitationEventIds(citations),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    yield* fromPromise(() => repository.saveQaSession(answer))
    return answer
  })
}

export function askCrossSessionQuestion(question: string, limit = 5) {
  return runDesktopEffect(askCrossSessionQuestionEffect(question, limit))
}

export function listSavedQaSessionsEffect(): DesktopEffect<ReturnType<typeof crossSessionQaAnswerSchema.parse>[]> {
  return Effect.map(
    fromPromise(() => repository.listQaSessions()),
    (sessions) => [...sessions].sort((left, right) => right.createdAt - left.createdAt),
  )
}

export function listSavedQaSessions() {
  return runDesktopEffect(listSavedQaSessionsEffect())
}

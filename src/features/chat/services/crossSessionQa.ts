import { searchRoomEvents } from '@/matrix/retrieval'
import { createKnowledgeRepository } from '@/shared/lib/knowledgeDb'
import { crossSessionQaAnswerSchema, toCitationEventIds } from '../types/knowledge'

const repository = createKnowledgeRepository()

export async function askCrossSessionQuestion(question: string, limit = 5) {
  const normalizedQuestion = question.trim()
  if (!normalizedQuestion)
    throw new Error('Question is required')

  const page = await searchRoomEvents(normalizedQuestion, limit)
  if (!page.items.length)
    throw new Error('No cited answer available')

  const evidence = page.items.slice(0, 3)
  const citations = evidence.map(item => ({
    roomId: item.roomId,
    eventId: item.eventId,
    quote: item.body,
  }))

  const answer = crossSessionQaAnswerSchema.parse({
    id: `qa:${Date.now()}`,
    question: normalizedQuestion,
    answer: evidence.map(item => item.body).join(' '),
    citations,
    citationEventIds: toCitationEventIds(citations),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })

  await repository.saveQaSession(answer)
  return answer
}

export async function listSavedQaSessions() {
  const sessions = await repository.listQaSessions()
  return [...sessions].sort((left, right) => right.createdAt - left.createdAt)
}

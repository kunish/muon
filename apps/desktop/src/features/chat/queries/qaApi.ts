import type { CrossSessionQaAnswer } from '../types/knowledge'
import { askCrossSessionQuestion, listSavedQaSessions } from '../services/crossSessionQa'

function sortByNewest(sessions: CrossSessionQaAnswer[]): CrossSessionQaAnswer[] {
  return [...sessions].sort((left, right) => right.createdAt - left.createdAt)
}

export function upsertQaAnswer(history: CrossSessionQaAnswer[], answer: CrossSessionQaAnswer): CrossSessionQaAnswer[] {
  return sortByNewest([answer, ...history.filter((item) => item.id !== answer.id)])
}

export async function loadQaHistory(): Promise<CrossSessionQaAnswer[]> {
  return sortByNewest(await listSavedQaSessions())
}

export async function askQuestionEntry(question: string): Promise<CrossSessionQaAnswer> {
  return askCrossSessionQuestion(question)
}

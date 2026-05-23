import type { CrossSessionQaAnswer } from '../types/knowledge'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { askCrossSessionQuestion, listSavedQaSessions } from '../services/crossSessionQa'

function sortByNewest(sessions: CrossSessionQaAnswer[]) {
  return [...sessions].sort((left, right) => right.createdAt - left.createdAt)
}

export const useQaStore = defineStore('qa', () => {
  const history = ref<CrossSessionQaAnswer[]>([])
  const activeAnswer = ref<CrossSessionQaAnswer | null>(null)

  function setHistory(sessions: CrossSessionQaAnswer[]) {
    history.value = sortByNewest(sessions)
    activeAnswer.value = history.value[0] ?? null
  }

  function upsertAnswer(answer: CrossSessionQaAnswer) {
    history.value = sortByNewest([answer, ...history.value.filter((item) => item.id !== answer.id)])
    activeAnswer.value = answer
  }

  function hydrateHistoryEffect(): DesktopEffect<CrossSessionQaAnswer[]> {
    return Effect.gen(function* () {
      const sessions = yield* fromPromise(() => listSavedQaSessions())
      yield* fromSync(() => setHistory(sessions))
      return history.value
    })
  }

  function hydrateHistory() {
    return runDesktopEffect(hydrateHistoryEffect())
  }

  function askQuestionEffect(question: string): DesktopEffect<CrossSessionQaAnswer> {
    return Effect.gen(function* () {
      const answer = yield* fromPromise(() => askCrossSessionQuestion(question))
      yield* fromSync(() => upsertAnswer(answer))
      return answer
    })
  }

  function askQuestion(question: string) {
    return runDesktopEffect(askQuestionEffect(question))
  }

  function selectAnswer(answerId: string) {
    activeAnswer.value = history.value.find((item) => item.id === answerId) ?? activeAnswer.value
  }

  return {
    history,
    activeAnswer,
    hydrateHistoryEffect,
    askQuestionEffect,
    hydrateHistory,
    askQuestion,
    selectAnswer,
  }
})

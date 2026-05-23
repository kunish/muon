import type { CrossSessionQaAnswer } from '../types/knowledge'
import { defineStore } from 'pinia'
import { ref } from 'vue'
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
    history.value = sortByNewest([
      answer,
      ...history.value.filter(item => item.id !== answer.id),
    ])
    activeAnswer.value = answer
  }

  async function hydrateHistory() {
    const sessions = await listSavedQaSessions()
    setHistory(sessions)
    return history.value
  }

  async function askQuestion(question: string) {
    const answer = await askCrossSessionQuestion(question)
    upsertAnswer(answer)
    return answer
  }

  function selectAnswer(answerId: string) {
    activeAnswer.value = history.value.find(item => item.id === answerId) ?? activeAnswer.value
  }

  return {
    history,
    activeAnswer,
    hydrateHistory,
    askQuestion,
    selectAnswer,
  }
})

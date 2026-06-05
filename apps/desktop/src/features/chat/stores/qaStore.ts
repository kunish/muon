import { Store } from '@tanstack/vue-store'

export interface QaState {
  selectedAnswerId: string | null
}

function createInitialState(): QaState {
  return { selectedAnswerId: null }
}

export const qaStore = new Store<QaState>(createInitialState())

export function selectQaAnswer(answerId: string | null) {
  qaStore.setState((prev) => ({ ...prev, selectedAnswerId: answerId }))
}

export function resetQaStore() {
  qaStore.setState(() => createInitialState())
}

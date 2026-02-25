import type { CallHistoryEntry } from '../types'
import { ref } from 'vue'

const history = ref<CallHistoryEntry[]>([])

export function useCallHistory() {
  function addEntry(entry: CallHistoryEntry) {
    history.value.unshift(entry)
  }

  function getHistory() {
    return history.value
  }

  return { history, addEntry, getHistory }
}

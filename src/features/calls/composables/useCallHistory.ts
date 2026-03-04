import type { CallHistoryEntry } from '../types'
import { ref } from 'vue'

const history = ref<CallHistoryEntry[]>([])

export function useCallHistory() {
  return { history }
}

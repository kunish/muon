const STORAGE_KEY = 'muon_search_history'
const MAX_ENTRIES = 8

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((term): term is string => typeof term === 'string' && term.trim().length > 0)
      .slice(0, MAX_ENTRIES)
  } catch {
    return []
  }
}

/**
 * 全局搜索历史（飞书：空查询时展示最近搜索词）。
 * 实例本地的 ref，从 localStorage 初始化；record/remove/clear 同步落盘。
 */
export function useSearchHistory() {
  const history = ref<string[]>(loadHistory())

  function persist() {
    try {
      if (history.value.length === 0) localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(history.value))
    } catch {
      /* localStorage 不可用时静默降级 */
    }
  }

  function record(term: string) {
    const trimmed = term.trim()
    if (!trimmed) return
    history.value = [trimmed, ...history.value.filter((entry) => entry !== trimmed)].slice(0, MAX_ENTRIES)
    persist()
  }

  function remove(term: string) {
    const next = history.value.filter((entry) => entry !== term)
    if (next.length === history.value.length) return
    history.value = next
    persist()
  }

  function clear() {
    if (history.value.length === 0) return
    history.value = []
    persist()
  }

  return { history, record, remove, clear }
}

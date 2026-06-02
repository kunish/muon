import { defineStore } from 'pinia'
import { ref } from 'vue'

export const WORKPLACE_STORAGE_KEY = 'muon.workplace.customization.v1'

/** 用户自定义应用的可序列化形态（图标/路由由组件侧用默认值补齐） */
export interface PersistedCustomApp {
  id: string
  name: string
  desc: string
  category: string
}

interface PersistedWorkplaceState {
  version: 1
  hiddenAppIds: string[]
  appOrder: string[]
  customApps: PersistedCustomApp[]
}

function isPersistedCustomApp(value: unknown): value is PersistedCustomApp {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PersistedCustomApp>
  return (
    typeof candidate.id === 'string' &&
    !!candidate.id &&
    typeof candidate.name === 'string' &&
    typeof candidate.desc === 'string' &&
    typeof candidate.category === 'string'
  )
}

function loadState(): Pick<PersistedWorkplaceState, 'hiddenAppIds' | 'appOrder' | 'customApps'> {
  const empty = { hiddenAppIds: [], appOrder: [], customApps: [] }
  try {
    const raw = localStorage.getItem(WORKPLACE_STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<PersistedWorkplaceState>
    if (parsed.version !== 1) return empty
    return {
      hiddenAppIds: Array.isArray(parsed.hiddenAppIds)
        ? parsed.hiddenAppIds.filter((id) => typeof id === 'string')
        : [],
      appOrder: Array.isArray(parsed.appOrder) ? parsed.appOrder.filter((id) => typeof id === 'string') : [],
      customApps: Array.isArray(parsed.customApps) ? parsed.customApps.filter(isPersistedCustomApp) : [],
    }
  } catch {
    return empty
  }
}

export const useWorkplaceStore = defineStore('workplace', () => {
  const initial = loadState()
  const hiddenAppIds = ref<string[]>(initial.hiddenAppIds)
  const appOrder = ref<string[]>(initial.appOrder)
  const customApps = ref<PersistedCustomApp[]>(initial.customApps)

  function persist(): void {
    const payload: PersistedWorkplaceState = {
      version: 1,
      hiddenAppIds: hiddenAppIds.value,
      appOrder: appOrder.value,
      customApps: customApps.value,
    }
    try {
      localStorage.setItem(WORKPLACE_STORAGE_KEY, JSON.stringify(payload))
    } catch (err) {
      console.warn('[workplaceStore] Failed to persist customization:', err)
    }
  }

  function addCustomApp(app: PersistedCustomApp): void {
    customApps.value = [app, ...customApps.value]
    persist()
  }

  function updateCustomApp(id: string, patch: { name: string; desc: string }): void {
    customApps.value = customApps.value.map((app) => (app.id === id ? { ...app, ...patch } : app))
    persist()
  }

  function hideApp(id: string): void {
    hiddenAppIds.value = [...new Set([...hiddenAppIds.value, id])]
    persist()
  }

  function setOrder(orderedIds: string[]): void {
    appOrder.value = orderedIds
    persist()
  }

  return {
    hiddenAppIds,
    appOrder,
    customApps,
    addCustomApp,
    updateCustomApp,
    hideApp,
    setOrder,
  }
})

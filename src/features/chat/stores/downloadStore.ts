import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface DownloadItem {
  id: string
  fileName: string
  url: string
  savePath: string
  size: number
  downloaded: number
  status: 'pending' | 'downloading' | 'completed' | 'failed'
  startedAt: number
  completedAt?: number
  error?: string
}

export const useDownloadStore = defineStore('downloads', () => {
  const items = ref<DownloadItem[]>([])

  const activeCount = computed(() =>
    items.value.filter(i => i.status === 'downloading').length,
  )

  function removeDownload(id: string) {
    items.value = items.value.filter(i => i.id !== id)
  }

  function clearCompleted() {
    items.value = items.value.filter(i => i.status !== 'completed')
  }

  return {
    items,
    activeCount,
    removeDownload,
    clearCompleted,
  }
})

import { Store } from '@tanstack/vue-store'

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

export interface DownloadState {
  items: DownloadItem[]
}

function createInitialState(): DownloadState {
  return { items: [] }
}

export const downloadStore = new Store<DownloadState>(createInitialState())

/** Replace the tracked downloads (the seam download events / IPC will write through). */
export function setDownloadItems(items: DownloadItem[]) {
  downloadStore.setState((prev) => ({ ...prev, items }))
}

export function removeDownload(id: string) {
  downloadStore.setState((prev) => ({ ...prev, items: prev.items.filter((item) => item.id !== id) }))
}

export function clearCompleted() {
  downloadStore.setState((prev) => ({ ...prev, items: prev.items.filter((item) => item.status !== 'completed') }))
}

export function resetDownloadStore() {
  downloadStore.setState(() => createInitialState())
}

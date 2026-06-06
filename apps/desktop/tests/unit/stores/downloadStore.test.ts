import type { DownloadItem } from '@/features/chat/stores/downloadStore'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearCompleted,
  downloadStore,
  removeDownload,
  resetDownloadStore,
  setDownloadItems,
} from '@/features/chat/stores/downloadStore'

function item(id: string, status: DownloadItem['status']): DownloadItem {
  return {
    id,
    fileName: `${id}.pdf`,
    url: `mxc://localhost/${id}`,
    savePath: `/tmp/${id}.pdf`,
    size: 1024,
    downloaded: status === 'completed' ? 1024 : 0,
    status,
    startedAt: 100,
  }
}

describe('downloadStore (client state)', () => {
  beforeEach(() => {
    resetDownloadStore()
  })

  it('starts with no tracked downloads', () => {
    expect(downloadStore.state.items).toEqual([])
  })

  it('setDownloadItems replaces the tracked downloads', () => {
    setDownloadItems([item('a', 'downloading'), item('b', 'completed')])
    expect(downloadStore.state.items.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('removeDownload drops a single item by id', () => {
    setDownloadItems([item('a', 'downloading'), item('b', 'completed')])
    removeDownload('a')
    expect(downloadStore.state.items.map((i) => i.id)).toEqual(['b'])
  })

  it('clearCompleted removes only completed items', () => {
    setDownloadItems([item('a', 'downloading'), item('b', 'completed'), item('c', 'failed')])
    clearCompleted()
    expect(downloadStore.state.items.map((i) => i.id)).toEqual(['a', 'c'])
  })

  it('resetDownloadStore clears all items', () => {
    setDownloadItems([item('a', 'completed')])
    resetDownloadStore()
    expect(downloadStore.state.items).toEqual([])
  })
})

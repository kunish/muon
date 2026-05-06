import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDocsStore } from '@/features/docs/stores/docsStore'

vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => ({
    getRooms: vi.fn(() => []),
    createRoom: vi.fn().mockResolvedValue({
      room_id: '!new:localhost',
    }),
    getUserId: vi.fn(() => '@test:localhost'),
  })),
}))

describe('docsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with empty documents', () => {
    const store = useDocsStore()
    expect(store.documents).toEqual([])
  })

  it('filters documents by search query', () => {
    const store = useDocsStore()
    store.documents = [{
      id: '1',
      title: '测试文档',
      owner: '用户',
      updated: '刚刚',
      type: '文档',
      status: '草稿',
      folder: '全部文档',
      sectionIds: ['recent'],
    }]
    store.searchQuery = '测试'
    expect(store.filteredDocuments).toHaveLength(1)
    store.searchQuery = '不存在'
    expect(store.filteredDocuments).toHaveLength(0)
  })

  it('creates document and returns room id', async () => {
    const store = useDocsStore()
    const roomId = await store.createDocument('新文档', '工程文档')
    expect(roomId).toBe('!new:localhost')
  })
})

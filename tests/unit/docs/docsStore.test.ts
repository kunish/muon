import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDocsStore } from '@/features/docs/stores/docsStore'
import { MATRIX_EVENT_TYPES } from '@/features/docs/types/doc'

const mockRoomEvents = vi.hoisted(() => [
  {
    getType: () => 'org.muon.doc.metadata',
    getContent: () => ({
      title: '旧标题',
      owner: '@test:localhost',
      updated: '昨天',
      type: '文档',
      status: '草稿',
      folder: '工程文档',
      sectionIds: ['recent'],
      createdAt: 1,
    }),
  },
])

const mockClient = vi.hoisted(() => ({
  getRooms: vi.fn(() => []),
  getRoom: vi.fn(() => ({
    roomId: '!doc:localhost',
    getLiveTimeline: () => ({
      getEvents: () => mockRoomEvents,
    }),
  })),
  createRoom: vi.fn().mockResolvedValue({
    room_id: '!new:localhost',
  }),
  getUserId: vi.fn(() => '@test:localhost'),
  sendStateEvent: vi.fn().mockResolvedValue({ event_id: '$metadata' }),
  sendEvent: vi.fn().mockResolvedValue({ event_id: '$metadata-event' }),
  setRoomName: vi.fn().mockResolvedValue(undefined),
  leave: vi.fn().mockResolvedValue(undefined),
  getAccountData: vi.fn(() => null),
  setAccountData: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => mockClient),
}))

function makeMetadataEvent(content: Record<string, unknown>) {
  return {
    getType: () => MATRIX_EVENT_TYPES.DOC_METADATA,
    getContent: () => content,
  }
}

function makeDocRoom(content: Record<string, unknown>, timelineContent: Record<string, unknown>[] = [content]) {
  return {
    roomId: '!doc:localhost',
    currentState: {
      getStateEvents: vi.fn(() => makeMetadataEvent(content)),
    },
    getLiveTimeline: () => ({
      getEvents: () => timelineContent.map(makeMetadataEvent),
    }),
  }
}

function makeForbiddenError(): Error & { errcode: string, statusCode: number } {
  const err = new Error('[403] M_FORBIDDEN: Event is not authorized.') as Error & { errcode: string, statusCode: number }
  err.errcode = 'M_FORBIDDEN'
  err.statusCode = 403
  return err
}

function makeForbiddenMatrixErrorObject(): { errcode: string, httpStatus: number, message: string } {
  return {
    errcode: 'M_FORBIDDEN',
    httpStatus: 403,
    message: 'MatrixError: [403] M_FORBIDDEN: Event is not authorized.',
  }
}

describe('docsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockClient.getRooms.mockReturnValue([])
    mockClient.getRoom.mockReturnValue({
      roomId: '!doc:localhost',
      getLiveTimeline: () => ({
        getEvents: () => mockRoomEvents,
      }),
    })
    mockClient.createRoom.mockClear()
    mockClient.sendStateEvent.mockClear()
    mockClient.sendEvent.mockClear()
    mockClient.setRoomName.mockClear()
    mockClient.leave.mockClear()
    mockClient.getAccountData.mockReturnValue(null)
    mockClient.setAccountData.mockClear()
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
    expect(store.documents[0]).toMatchObject({
      id: '!new:localhost',
      title: '新文档',
      folder: '工程文档',
    })
  })

  it('falls back to timeline metadata when create room initial state is forbidden', async () => {
    const store = useDocsStore()
    mockClient.createRoom
      .mockRejectedValueOnce(makeForbiddenError())
      .mockResolvedValueOnce({ room_id: '!fallback:localhost' })
    mockClient.sendStateEvent.mockRejectedValueOnce(makeForbiddenError())

    const roomId = await store.createDocument('新文档', '工程文档')

    expect(roomId).toBe('!fallback:localhost')
    expect(mockClient.createRoom).toHaveBeenCalledTimes(2)
    expect(mockClient.sendEvent).toHaveBeenCalledWith(
      '!fallback:localhost',
      MATRIX_EVENT_TYPES.DOC_METADATA,
      expect.objectContaining({
        title: '新文档',
        folder: '工程文档',
      }),
    )
    expect(store.documents[0]).toMatchObject({
      id: '!fallback:localhost',
      title: '新文档',
    })
  })

  it('loads persisted folders as a tree without built-in folders', async () => {
    const store = useDocsStore()
    mockClient.getAccountData.mockReturnValue({
      getContent: () => ({
        folders: [
          { id: 'folder:parent', name: '团队文档', parentId: '', createdAt: 1, updatedAt: 1 },
          { id: 'folder:child', name: '方案', parentId: 'folder:parent', createdAt: 2, updatedAt: 2 },
        ],
      }),
    })

    await store.loadFolders()

    expect(store.folderTree.children.map(folder => folder.name)).toEqual(['团队文档'])
    expect(store.folderTree.children[0]?.children.map(folder => folder.name)).toEqual(['方案'])
    expect(store.folderTree.children.map(folder => folder.name)).not.toContain('产品规划')
  })

  it('derives legacy folder paths from document metadata as nested folders', () => {
    const store = useDocsStore()
    store.documents = [{
      id: '!doc:localhost',
      title: '接口设计',
      owner: '@test:localhost',
      updated: '刚刚',
      type: '文档',
      status: '草稿',
      folder: '工程文档/接口',
      sectionIds: ['recent'],
    }]

    expect(store.folderTree.children[0]?.name).toBe('工程文档')
    expect(store.folderTree.children[0]?.children[0]?.name).toBe('接口')
    expect(store.folderTree.children[0]?.count).toBe(1)
    expect(store.folderTree.children[0]?.children[0]?.count).toBe(1)
  })

  it('filters documents by selected folder including descendant folders', () => {
    const store = useDocsStore()
    store.folders = [
      { id: 'folder:parent', name: '团队文档', parentId: '', createdAt: 1, updatedAt: 1 },
      { id: 'folder:child', name: '方案', parentId: 'folder:parent', createdAt: 2, updatedAt: 2 },
    ]
    store.documents = [
      {
        id: '!child:localhost',
        title: '子文件夹文档',
        owner: '@test:localhost',
        updated: '刚刚',
        type: '文档',
        status: '草稿',
        folder: 'folder:child',
        sectionIds: ['recent'],
      },
      {
        id: '!other:localhost',
        title: '其他文档',
        owner: '@test:localhost',
        updated: '刚刚',
        type: '文档',
        status: '草稿',
        folder: '',
        sectionIds: ['recent'],
      },
    ]

    store.activeFolder = 'folder:parent'

    expect(store.filteredDocuments.map(doc => doc.id)).toEqual(['!child:localhost'])
  })

  it('persists newly created folders in Matrix account data', async () => {
    const store = useDocsStore()

    const folderId = await store.createFolder('研发资料', '')

    expect(folderId).toMatch(/^folder:/)
    expect(store.folders[0]).toMatchObject({ id: folderId, name: '研发资料', parentId: '' })
    expect(mockClient.setAccountData).toHaveBeenCalledWith(
      MATRIX_EVENT_TYPES.DOC_FOLDERS,
      expect.objectContaining({
        folders: [expect.objectContaining({ id: folderId, name: '研发资料', parentId: '' })],
      }),
    )
  })

  it('loads document metadata from current room state instead of stale timeline events', async () => {
    const store = useDocsStore()
    mockClient.getRooms.mockReturnValue([
      makeDocRoom(
        {
          title: '保存后的标题',
          owner: '@test:localhost',
          updated: '刚刚',
          type: '文档',
          status: '草稿',
          folder: '工程文档',
          sectionIds: ['recent'],
          updatedAt: 2,
        },
        [{
          title: '新建协作文档',
          owner: '@test:localhost',
          updated: '刚刚',
          type: '文档',
          status: '草稿',
          folder: '工程文档',
          sectionIds: ['recent'],
          createdAt: 1,
        }],
      ),
    ])

    await store.loadDocuments()

    expect(store.documents[0]?.title).toBe('保存后的标题')
  })

  it('falls back to the newest metadata timeline event when current state is unavailable', async () => {
    const store = useDocsStore()
    mockClient.getRooms.mockReturnValue([
      {
        roomId: '!doc:localhost',
        getLiveTimeline: () => ({
          getEvents: () => [
            makeMetadataEvent({
              title: '新建协作文档',
              owner: '@test:localhost',
              updated: '刚刚',
              type: '文档',
              status: '草稿',
              folder: '工程文档',
              sectionIds: ['recent'],
              createdAt: 1,
            }),
            makeMetadataEvent({
              title: '保存后的标题',
              owner: '@test:localhost',
              updated: '刚刚',
              type: '文档',
              status: '草稿',
              folder: '工程文档',
              sectionIds: ['recent'],
              updatedAt: 2,
            }),
          ],
        }),
      },
    ])

    await store.loadDocuments()

    expect(store.documents[0]?.title).toBe('保存后的标题')
  })

  it('updates document title in metadata, room name, and local list', async () => {
    const store = useDocsStore()
    store.documents = [{
      id: '!doc:localhost',
      title: '旧标题',
      owner: '@test:localhost',
      updated: '昨天',
      type: '文档',
      status: '草稿',
      folder: '工程文档',
      sectionIds: ['recent'],
    }]

    await store.updateDocumentTitle('!doc:localhost', '新标题')

    expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
      '!doc:localhost',
      MATRIX_EVENT_TYPES.DOC_METADATA,
      expect.objectContaining({
        title: '新标题',
        folder: '工程文档',
        status: '草稿',
        updated: '刚刚',
      }),
    )
    expect(mockClient.setRoomName).toHaveBeenCalledWith('!doc:localhost', '新标题')
    expect(store.documents[0]?.title).toBe('新标题')
  })

  it('falls back to a timeline metadata event when title state update is forbidden', async () => {
    const store = useDocsStore()
    store.documents = [{
      id: '!doc:localhost',
      title: '旧标题',
      owner: '@test:localhost',
      updated: '昨天',
      type: '文档',
      status: '草稿',
      folder: '工程文档',
      sectionIds: ['recent'],
    }]
    mockClient.sendStateEvent.mockRejectedValueOnce(makeForbiddenError())
    mockClient.setRoomName.mockRejectedValueOnce(makeForbiddenError())

    await store.updateDocumentTitle('!doc:localhost', '新标题')

    expect(mockClient.sendEvent).toHaveBeenCalledWith(
      '!doc:localhost',
      MATRIX_EVENT_TYPES.DOC_METADATA,
      expect.objectContaining({
        title: '新标题',
        folder: '工程文档',
      }),
    )
    expect(store.documents[0]?.title).toBe('新标题')
  })

  it('keeps title changes local when both metadata writes are forbidden', async () => {
    const store = useDocsStore()
    store.documents = [{
      id: '!doc:localhost',
      title: '旧标题',
      owner: '@test:localhost',
      updated: '昨天',
      type: '文档',
      status: '草稿',
      folder: '工程文档',
      sectionIds: ['recent'],
    }]
    mockClient.sendStateEvent.mockRejectedValueOnce(makeForbiddenMatrixErrorObject())
    mockClient.sendEvent.mockRejectedValueOnce(makeForbiddenMatrixErrorObject())
    mockClient.setRoomName.mockRejectedValueOnce(makeForbiddenMatrixErrorObject())

    await expect(store.updateDocumentTitle('!doc:localhost', '新标题')).resolves.toBeUndefined()

    expect(mockClient.sendEvent).toHaveBeenCalledWith(
      '!doc:localhost',
      MATRIX_EVENT_TYPES.DOC_METADATA,
      expect.objectContaining({ title: '新标题' }),
    )
    expect(store.documents[0]?.title).toBe('新标题')
  })

  it('moves a document to a selected folder in metadata and the local list', async () => {
    const store = useDocsStore()
    store.documents = [{
      id: '!doc:localhost',
      title: '旧标题',
      owner: '@test:localhost',
      updated: '昨天',
      type: '文档',
      status: '草稿',
      folder: '',
      sectionIds: ['recent'],
    }]

    await store.updateDocumentFolder('!doc:localhost', 'folder:target')

    expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
      '!doc:localhost',
      MATRIX_EVENT_TYPES.DOC_METADATA,
      expect.objectContaining({
        title: '旧标题',
        folder: 'folder:target',
        updated: '刚刚',
      }),
    )
    expect(store.documents[0]?.folder).toBe('folder:target')
  })

  it('falls back to a timeline metadata event when moving a document without state permission', async () => {
    const store = useDocsStore()
    store.documents = [{
      id: '!doc:localhost',
      title: '旧标题',
      owner: '@test:localhost',
      updated: '昨天',
      type: '文档',
      status: '草稿',
      folder: '',
      sectionIds: ['recent'],
    }]
    mockClient.sendStateEvent.mockRejectedValueOnce(makeForbiddenError())

    await store.updateDocumentFolder('!doc:localhost', 'folder:target')

    expect(mockClient.sendEvent).toHaveBeenCalledWith(
      '!doc:localhost',
      MATRIX_EVENT_TYPES.DOC_METADATA,
      expect.objectContaining({
        title: '旧标题',
        folder: 'folder:target',
      }),
    )
    expect(store.documents[0]?.folder).toBe('folder:target')
  })

  it('keeps a locally moved folder when a reload sees stale room metadata', async () => {
    const store = useDocsStore()
    store.documents = [{
      id: '!doc:localhost',
      title: '旧标题',
      owner: '@test:localhost',
      updated: '昨天',
      type: '文档',
      status: '草稿',
      folder: '',
      sectionIds: ['recent'],
    }]

    await store.updateDocumentFolder('!doc:localhost', 'folder:target')

    mockClient.getRooms.mockReturnValue([
      makeDocRoom({
        title: '旧标题',
        owner: '@test:localhost',
        updated: '昨天',
        type: '文档',
        status: '草稿',
        folder: '',
        sectionIds: ['recent'],
        createdAt: 1,
      }),
    ])
    await store.loadDocuments()

    expect(store.documents[0]?.folder).toBe('folder:target')
  })

  it('keeps a locally saved title when a reload sees stale room metadata', async () => {
    const store = useDocsStore()
    store.documents = [{
      id: '!doc:localhost',
      title: '新建协作文档',
      owner: '@test:localhost',
      updated: '刚刚',
      type: '文档',
      status: '草稿',
      folder: '工程文档',
      sectionIds: ['recent'],
    }]

    await store.updateDocumentTitle('!doc:localhost', '产品计划')

    mockClient.getRooms.mockReturnValue([
      makeDocRoom({
        title: '新建协作文档',
        owner: '@test:localhost',
        updated: '刚刚',
        type: '文档',
        status: '草稿',
        folder: '工程文档',
        sectionIds: ['recent'],
        createdAt: 1,
      }),
    ])
    await store.loadDocuments()

    expect(store.documents[0]?.title).toBe('产品计划')
  })

  it('deletes a document by leaving the room and removing it locally', async () => {
    const store = useDocsStore()
    store.documents = [{
      id: '!doc:localhost',
      title: '待删除',
      owner: '@test:localhost',
      updated: '刚刚',
      type: '文档',
      status: '草稿',
      folder: '工程文档',
      sectionIds: ['recent'],
    }]

    await store.deleteDocument('!doc:localhost')

    expect(mockClient.leave).toHaveBeenCalledWith('!doc:localhost')
    expect(store.documents).toEqual([])
  })
})

import type { DocEntry, DocFolderNode, DocFolderRecord, DocSectionId } from '../types/doc'
import { getClient } from '@matrix/client'
import { Visibility } from 'matrix-js-sdk'
import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import { MATRIX_EVENT_TYPES } from '../types/doc'

interface DocMetadataContent {
  title?: string
  owner?: string
  updated?: string
  type?: string
  status?: DocEntry['status']
  folder?: string
  sectionIds?: DocSectionId[]
  createdAt?: number
  updatedAt?: number
}

interface DocFoldersAccountContent {
  folders?: unknown
}

interface MatrixDocEvent {
  getType: () => string
  getContent: () => DocMetadataContent
}

interface MatrixAccountDataEvent {
  getContent: () => DocFoldersAccountContent
}

interface MatrixDocRoom {
  roomId: string
  currentState?: {
    getStateEvents: (eventType: string, stateKey?: string) => MatrixDocEvent | MatrixDocEvent[] | null | undefined
  }
  getLiveTimeline: () => {
    getEvents: () => MatrixDocEvent[]
  }
}

interface LocalDocMetadataOverride {
  title?: string
  folder?: string
  updated: string
  updatedAt: number
}

interface MatrixDocAccountClient {
  getAccountData?: (eventType: string) => MatrixAccountDataEvent | null | undefined
  setAccountData?: (eventType: string, content: DocFoldersAccountContent) => Promise<unknown>
}

interface MatrixDocMetadataClient {
  sendStateEvent: (roomId: string, eventType: string, content: unknown) => Promise<unknown>
  sendEvent?: (roomId: string, eventType: string, content: unknown) => Promise<unknown>
  setRoomName?: (roomId: string, name: string) => Promise<unknown>
}

interface MutableDocFolderNode extends DocFolderNode {
  children: MutableDocFolderNode[]
}

export const ROOT_DOC_FOLDER_ID = ''
const ROOT_DOC_FOLDER_NAME = '全部文档'

function getDocMetadataEvent(room: MatrixDocRoom): MatrixDocEvent | undefined {
  const stateEvent = room.currentState?.getStateEvents(MATRIX_EVENT_TYPES.DOC_METADATA, '')
  if (Array.isArray(stateEvent) && stateEvent.length > 0)
    return stateEvent[0]
  if (!Array.isArray(stateEvent) && stateEvent)
    return stateEvent

  const events = room.getLiveTimeline().getEvents()
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]
    if (event?.getType() === MATRIX_EVENT_TYPES.DOC_METADATA)
      return event
  }
}

function getMetadataTimestamp(content: DocMetadataContent): number {
  return content.updatedAt ?? content.createdAt ?? 0
}

function isForbiddenMatrixError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null)
    return false

  const matrixError = err as {
    errcode?: unknown
    httpStatus?: unknown
    statusCode?: unknown
    status?: unknown
    data?: { errcode?: unknown }
    response?: { status?: unknown }
    message?: unknown
  }
  const message = typeof matrixError.message === 'string' ? matrixError.message : ''
  return matrixError.errcode === 'M_FORBIDDEN'
    || matrixError.data?.errcode === 'M_FORBIDDEN'
    || matrixError.httpStatus === 403
    || matrixError.statusCode === 403
    || matrixError.status === 403
    || matrixError.response?.status === 403
    || message.includes('M_FORBIDDEN')
    || message.includes('[403]')
}

function normalizeFolderId(folder?: string): string {
  const normalized = (folder ?? '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/')
  return normalized === ROOT_DOC_FOLDER_NAME ? ROOT_DOC_FOLDER_ID : normalized
}

function sanitizeFolderName(name: string): string {
  return name.trim() || '新建文件夹'
}

function createFolderId(): string {
  if (globalThis.crypto?.randomUUID)
    return `folder:${globalThis.crypto.randomUUID()}`
  return `folder:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`
}

function isDocFolderRecord(value: unknown): value is DocFolderRecord {
  return typeof value === 'object'
    && value !== null
    && typeof (value as DocFolderRecord).id === 'string'
    && typeof (value as DocFolderRecord).name === 'string'
}

function normalizeFolderRecord(value: unknown): DocFolderRecord | null {
  if (!isDocFolderRecord(value))
    return null

  const id = normalizeFolderId(value.id)
  if (!id)
    return null

  const now = Date.now()
  return {
    id,
    name: sanitizeFolderName(value.name),
    parentId: normalizeFolderId(value.parentId),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now,
  }
}

function createFolderNode(
  id: string,
  name: string,
  parentId: string,
  depth: number,
  isPersisted: boolean,
): MutableDocFolderNode {
  return {
    id,
    name,
    parentId,
    depth,
    count: 0,
    isPersisted,
    children: [],
  }
}

function ensureLegacyFolderPath(folderId: string, nodesById: Map<string, MutableDocFolderNode>): void {
  const normalized = normalizeFolderId(folderId)
  if (!normalized)
    return

  let parentId = ROOT_DOC_FOLDER_ID
  let path = ''
  const segments = normalized.split('/').filter(Boolean)
  segments.forEach((segment, index) => {
    path = path ? `${path}/${segment}` : segment
    if (!nodesById.has(path)) {
      nodesById.set(path, createFolderNode(path, segment, parentId, index + 1, false))
    }
    parentId = path
  })
}

function attachFolderNodes(nodesById: Map<string, MutableDocFolderNode>, root: MutableDocFolderNode): void {
  for (const node of nodesById.values()) {
    node.children = []
  }

  for (const node of nodesById.values()) {
    if (node.id === ROOT_DOC_FOLDER_ID)
      continue

    const parent = nodesById.get(node.parentId) ?? root
    node.parentId = parent.id
    node.depth = parent.depth + 1
    parent.children.push(node)
  }
}

function sortFolderTree(node: MutableDocFolderNode): void {
  node.children.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
  node.children.forEach(sortFolderTree)
}

function findFolderNode(node: DocFolderNode, folderId: string): DocFolderNode | null {
  if (node.id === folderId)
    return node
  for (const child of node.children) {
    const found = findFolderNode(child, folderId)
    if (found)
      return found
  }
  return null
}

function collectFolderIds(node: DocFolderNode, folderIds: Set<string>): void {
  folderIds.add(node.id)
  node.children.forEach(child => collectFolderIds(child, folderIds))
}

function buildFolderTree(documents: DocEntry[], folders: DocFolderRecord[]): DocFolderNode {
  const root = createFolderNode(ROOT_DOC_FOLDER_ID, ROOT_DOC_FOLDER_NAME, ROOT_DOC_FOLDER_ID, 0, true)
  const nodesById = new Map<string, MutableDocFolderNode>([[ROOT_DOC_FOLDER_ID, root]])

  folders.forEach((folder) => {
    const id = normalizeFolderId(folder.id)
    if (!id)
      return
    const parentId = normalizeFolderId(folder.parentId)
    if (parentId && parentId.includes('/'))
      ensureLegacyFolderPath(parentId, nodesById)
    nodesById.set(id, createFolderNode(id, sanitizeFolderName(folder.name), parentId, 1, true))
  })

  documents.forEach((doc) => {
    const folderId = normalizeFolderId(doc.folder)
    if (!folderId)
      return
    if (!nodesById.has(folderId))
      ensureLegacyFolderPath(folderId, nodesById)
  })

  attachFolderNodes(nodesById, root)

  documents.forEach((doc) => {
    root.count += 1
    const folderId = normalizeFolderId(doc.folder)
    if (!folderId)
      return

    let node = nodesById.get(folderId)
    while (node && node.id !== ROOT_DOC_FOLDER_ID) {
      node.count += 1
      node = nodesById.get(node.parentId)
    }
  })

  sortFolderTree(root)
  return root
}

export const useDocsStore = defineStore('docs', () => {
  const documents = shallowRef<DocEntry[]>([])
  const folders = shallowRef<DocFolderRecord[]>([])
  const activeSection = shallowRef<DocSectionId>('recent')
  const activeFolder = shallowRef(ROOT_DOC_FOLDER_ID)
  const searchQuery = shallowRef('')
  const reviewOnly = shallowRef(false)
  const isLoading = shallowRef(false)
  const localMetadataOverrides = new Map<string, LocalDocMetadataOverride>()

  const folderTree = computed(() => buildFolderTree(documents.value, folders.value))
  const selectedFolderIds = computed(() => {
    const folderId = normalizeFolderId(activeFolder.value)
    if (!folderId)
      return null

    const node = findFolderNode(folderTree.value, folderId)
    if (!node)
      return new Set([folderId])

    const folderIds = new Set<string>()
    collectFolderIds(node, folderIds)
    return folderIds
  })

  function mergeLocalOverride(roomId: string, content: DocMetadataContent): DocMetadataContent {
    const override = localMetadataOverrides.get(roomId)
    if (!override)
      return content

    const titleSynced = !override.title || content.title === override.title
    const folderSynced = override.folder === undefined || normalizeFolderId(content.folder) === override.folder
    if ((titleSynced && folderSynced) || getMetadataTimestamp(content) > override.updatedAt) {
      localMetadataOverrides.delete(roomId)
      return content
    }

    return {
      ...content,
      title: override.title ?? content.title,
      folder: override.folder ?? content.folder,
      updated: override.updated,
      updatedAt: override.updatedAt,
    }
  }

  function updateLocalMetadataOverride(docId: string, patch: Partial<LocalDocMetadataOverride> & Pick<LocalDocMetadataOverride, 'updated' | 'updatedAt'>): void {
    localMetadataOverrides.set(docId, {
      ...(localMetadataOverrides.get(docId) ?? {}),
      ...patch,
    })
  }

  const filteredDocuments = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    return documents.value.filter((doc) => {
      const matchesQuery = !query
        || doc.title.toLowerCase().includes(query)
        || doc.owner.toLowerCase().includes(query)
      const matchesSection = doc.sectionIds.includes(activeSection.value)
      const matchesFolder = selectedFolderIds.value === null
        || selectedFolderIds.value.has(normalizeFolderId(doc.folder))
      const matchesReview = !reviewOnly.value || doc.status === '评审中'
      return matchesSection && matchesFolder && matchesQuery && matchesReview
    })
  })

  async function persistFolders(): Promise<void> {
    const client = getClient() as unknown as MatrixDocAccountClient
    try {
      await client.setAccountData?.(MATRIX_EVENT_TYPES.DOC_FOLDERS, { folders: folders.value })
    }
    catch (err) {
      if (!isForbiddenMatrixError(err))
        throw err
      console.warn('[Docs] Cannot persist folder tree account data:', err)
    }
  }

  async function sendDocMetadataEvent(docId: string, content: DocMetadataContent): Promise<void> {
    const client = getClient() as unknown as MatrixDocMetadataClient
    try {
      await client.sendStateEvent(docId, MATRIX_EVENT_TYPES.DOC_METADATA, content)
      return
    }
    catch (err) {
      if (!isForbiddenMatrixError(err))
        throw err
      if (!client.sendEvent) {
        console.warn('[Docs] Cannot persist document metadata state event:', err)
        return
      }
      console.warn('[Docs] Falling back to timeline metadata event:', err)
    }

    try {
      await client.sendEvent(docId, MATRIX_EVENT_TYPES.DOC_METADATA, content)
    }
    catch (err) {
      if (!isForbiddenMatrixError(err))
        throw err
      console.warn('[Docs] Cannot persist document metadata timeline event:', err)
    }
  }

  async function setDocumentRoomName(docId: string, title: string): Promise<void> {
    const client = getClient() as unknown as MatrixDocMetadataClient
    try {
      await client.setRoomName?.(docId, title)
    }
    catch (err) {
      if (!isForbiddenMatrixError(err))
        throw err
      console.warn('[Docs] Cannot update document room name:', err)
    }
  }

  async function loadFolders(): Promise<void> {
    try {
      const client = getClient() as unknown as MatrixDocAccountClient
      const content = client.getAccountData?.(MATRIX_EVENT_TYPES.DOC_FOLDERS)?.getContent()
      const rawFolders = Array.isArray(content?.folders) ? content.folders : []
      folders.value = rawFolders
        .map(normalizeFolderRecord)
        .filter((folder): folder is DocFolderRecord => folder !== null)
    }
    catch {
      folders.value = []
    }
  }

  async function loadDocuments(): Promise<void> {
    isLoading.value = true
    try {
      const client = getClient()
      const rooms = client.getRooms()
      const docRooms = rooms.filter((r) => {
        return !!getDocMetadataEvent(r as MatrixDocRoom)
      })

      documents.value = docRooms.map((room) => {
        const metaEvent = getDocMetadataEvent(room as MatrixDocRoom)
        const content = mergeLocalOverride(room.roomId, metaEvent?.getContent() ?? {})
        return {
          id: room.roomId,
          title: content.title || '无标题文档',
          owner: content.owner || '未知',
          updated: content.updated || '',
          type: content.type || '文档',
          status: content.status || '草稿',
          folder: normalizeFolderId(content.folder),
          sectionIds: content.sectionIds || ['recent'],
        }
      })
    }
    catch {
      documents.value = []
    }
    finally {
      isLoading.value = false
    }
  }

  async function createDocument(title: string, folder: string): Promise<string> {
    const client = getClient()
    const now = Date.now()
    const owner = client.getUserId()!
    const folderId = normalizeFolderId(folder)
    const metadataContent: DocMetadataContent = {
      title,
      owner,
      updated: '刚刚',
      type: '文档',
      status: '草稿',
      folder: folderId,
      sectionIds: ['recent'],
      createdAt: now,
    }
    let result: { room_id: string }
    try {
      result = await client.createRoom({
        name: title,
        visibility: Visibility.Private,
        initial_state: [{
          type: MATRIX_EVENT_TYPES.DOC_METADATA,
          content: metadataContent,
        }],
      })
    }
    catch (err) {
      if (!isForbiddenMatrixError(err))
        throw err
      result = await client.createRoom({
        name: title,
        visibility: Visibility.Private,
      })
      await sendDocMetadataEvent(result.room_id, metadataContent)
    }
    const createdDoc: DocEntry = {
      id: result.room_id,
      title,
      owner,
      updated: '刚刚',
      type: '文档',
      status: '草稿',
      folder: folderId,
      sectionIds: ['recent'],
    }
    await loadDocuments()
    if (!documents.value.some(doc => doc.id === createdDoc.id)) {
      documents.value = [createdDoc, ...documents.value]
    }
    return result.room_id
  }

  async function updateDocumentTitle(docId: string, title: string): Promise<void> {
    const nextTitle = title.trim() || '无标题文档'
    const now = Date.now()
    const client = getClient()
    const existing = documents.value.find(doc => doc.id === docId)
    const room = client.getRoom(docId)
    const metaEvent = room ? getDocMetadataEvent(room as MatrixDocRoom) : undefined
    const currentContent = metaEvent?.getContent() ?? {}
    const nextContent = {
      ...currentContent,
      title: nextTitle,
      owner: currentContent.owner || existing?.owner || client.getUserId() || '未知',
      updated: '刚刚',
      type: currentContent.type || existing?.type || '文档',
      status: currentContent.status || existing?.status || '草稿',
      folder: normalizeFolderId(currentContent.folder || existing?.folder),
      sectionIds: currentContent.sectionIds || existing?.sectionIds || ['recent'],
      updatedAt: now,
      createdAt: currentContent.createdAt || now,
    }

    await sendDocMetadataEvent(docId, nextContent)
    await setDocumentRoomName(docId, nextTitle)

    updateLocalMetadataOverride(docId, {
      title: nextTitle,
      updated: '刚刚',
      updatedAt: now,
    })

    documents.value = documents.value.map(doc => doc.id === docId
      ? {
          ...doc,
          title: nextTitle,
          updated: '刚刚',
          type: nextContent.type,
          status: nextContent.status,
          folder: nextContent.folder,
          sectionIds: nextContent.sectionIds,
        }
      : doc)
  }

  async function updateDocumentFolder(docId: string, folder: string): Promise<void> {
    const nextFolder = normalizeFolderId(folder)
    const now = Date.now()
    const client = getClient()
    const existing = documents.value.find(doc => doc.id === docId)
    const room = client.getRoom(docId)
    const metaEvent = room ? getDocMetadataEvent(room as MatrixDocRoom) : undefined
    const currentContent = metaEvent?.getContent() ?? {}
    const nextContent = {
      ...currentContent,
      title: currentContent.title || existing?.title || '无标题文档',
      owner: currentContent.owner || existing?.owner || client.getUserId() || '未知',
      updated: '刚刚',
      type: currentContent.type || existing?.type || '文档',
      status: currentContent.status || existing?.status || '草稿',
      folder: nextFolder,
      sectionIds: currentContent.sectionIds || existing?.sectionIds || ['recent'],
      updatedAt: now,
      createdAt: currentContent.createdAt || now,
    }

    await sendDocMetadataEvent(docId, nextContent)

    updateLocalMetadataOverride(docId, {
      folder: nextFolder,
      updated: '刚刚',
      updatedAt: now,
    })

    documents.value = documents.value.map(doc => doc.id === docId
      ? {
          ...doc,
          updated: '刚刚',
          type: nextContent.type,
          status: nextContent.status,
          folder: nextFolder,
          sectionIds: nextContent.sectionIds,
        }
      : doc)
  }

  async function deleteDocument(docId: string): Promise<void> {
    const client = getClient()
    await client.leave(docId)
    localMetadataOverrides.delete(docId)
    documents.value = documents.value.filter(doc => doc.id !== docId)
  }

  async function createFolder(name: string, parentId = activeFolder.value): Promise<string> {
    const targetParentId = normalizeFolderId(parentId)
    const now = Date.now()
    const folder: DocFolderRecord = {
      id: createFolderId(),
      name: sanitizeFolderName(name),
      parentId: targetParentId,
      createdAt: now,
      updatedAt: now,
    }

    folders.value = [...folders.value, folder]
    await persistFolders()
    return folder.id
  }

  async function renameFolder(folderId: string, name: string): Promise<void> {
    const targetFolderId = normalizeFolderId(folderId)
    const nextName = sanitizeFolderName(name)
    const now = Date.now()
    folders.value = folders.value.map(folder => folder.id === targetFolderId
      ? { ...folder, name: nextName, updatedAt: now }
      : folder)
    await persistFolders()
  }

  async function deleteFolder(folderId: string): Promise<void> {
    const targetFolderId = normalizeFolderId(folderId)
    if (!targetFolderId)
      return

    const node = findFolderNode(folderTree.value, targetFolderId)
    if (!node || node.count > 0)
      return

    const folderIds = new Set<string>()
    collectFolderIds(node, folderIds)
    folders.value = folders.value.filter(folder => !folderIds.has(folder.id))
    if (selectedFolderIds.value?.has(targetFolderId))
      activeFolder.value = ROOT_DOC_FOLDER_ID
    await persistFolders()
  }

  return {
    documents,
    folders,
    activeSection,
    activeFolder,
    searchQuery,
    reviewOnly,
    isLoading,
    folderTree,
    filteredDocuments,
    loadFolders,
    loadDocuments,
    createDocument,
    updateDocumentTitle,
    updateDocumentFolder,
    deleteDocument,
    createFolder,
    renameFolder,
    deleteFolder,
  }
})

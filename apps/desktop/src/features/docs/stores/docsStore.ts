import type { DocEntry, DocFolderNode, DocFolderRecord, DocSectionId } from '../types/doc'
import type { DesktopEffect } from '@/shared/lib/effect'
import { getClient } from '@matrix/client'
import { sendTextMessage } from '@matrix/index'
import { Effect } from 'effect'
import { Visibility } from 'matrix-js-sdk'
import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'
import { MATRIX_EVENT_TYPES } from '../types/doc'

interface DocMetadataContent {
  title?: string
  owner?: string
  updated?: string
  type?: string
  status?: DocEntry['status']
  folder?: string
  folderName?: string
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

interface RawFolderRecord {
  id?: unknown
  name?: unknown
  title?: unknown
  label?: unknown
  folderName?: unknown
  parentId?: unknown
  createdAt?: unknown
  updatedAt?: unknown
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
  folderName?: string
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
const LOCAL_DOC_METADATA_OVERRIDES_STORAGE_KEY = 'muon_docs_metadata_overrides_v1'
const DELETED_DOC_FOLDERS_STORAGE_KEY = 'muon_docs_deleted_folders_v1'

function readStorageItem(key: string): string | null {
  return runDesktopSync(readStorageItemEffect(key))
}

function readStorageItemEffect(key: string): DesktopEffect<string | null> {
  return fromSync(() => {
    return globalThis.localStorage?.getItem(key) ?? null
  }).pipe(Effect.catchAll(() => Effect.succeed(null)))
}

function writeStorageItem(key: string, value: string): void {
  runDesktopSync(writeStorageItemEffect(key, value))
}

function writeStorageItemEffect(key: string, value: string): DesktopEffect<void> {
  return fromSync(() => {
    globalThis.localStorage?.setItem(key, value)
  }).pipe(Effect.catchAll(() => Effect.void))
}

function removeStorageItem(key: string): void {
  runDesktopSync(removeStorageItemEffect(key))
}

function removeStorageItemEffect(key: string): DesktopEffect<void> {
  return fromSync(() => {
    globalThis.localStorage?.removeItem(key)
  }).pipe(Effect.catchAll(() => Effect.void))
}

function getDocMetadataEvent(room: MatrixDocRoom): MatrixDocEvent | undefined {
  const candidates: MatrixDocEvent[] = []
  const stateEvent = room.currentState?.getStateEvents(MATRIX_EVENT_TYPES.DOC_METADATA, '')
  if (Array.isArray(stateEvent)) candidates.push(...stateEvent)
  if (!Array.isArray(stateEvent) && stateEvent) candidates.push(stateEvent)

  const events = room.getLiveTimeline().getEvents()
  for (const event of events) {
    if (event?.getType() === MATRIX_EVENT_TYPES.DOC_METADATA) candidates.push(event)
  }

  return candidates.reduce<MatrixDocEvent | undefined>((latest, event) => {
    if (!latest) return event

    return getMetadataTimestamp(event.getContent()) > getMetadataTimestamp(latest.getContent()) ? event : latest
  }, undefined)
}

function getMetadataTimestamp(content: DocMetadataContent): number {
  return content.updatedAt ?? content.createdAt ?? 0
}

function normalizeLocalMetadataOverride(value: unknown): LocalDocMetadataOverride | null {
  if (typeof value !== 'object' || value === null) return null

  const override = value as Partial<LocalDocMetadataOverride>
  if (typeof override.updated !== 'string' || typeof override.updatedAt !== 'number') return null

  return {
    ...(typeof override.title === 'string' ? { title: override.title } : {}),
    ...(typeof override.folder === 'string' ? { folder: normalizeFolderId(override.folder) } : {}),
    ...(typeof override.folderName === 'string' ? { folderName: sanitizeFolderName(override.folderName) } : {}),
    updated: override.updated,
    updatedAt: override.updatedAt,
  }
}

function readLocalMetadataOverrides(): Map<string, LocalDocMetadataOverride> {
  return runDesktopSync(readLocalMetadataOverridesEffect())
}

function readLocalMetadataOverridesEffect(): DesktopEffect<Map<string, LocalDocMetadataOverride>> {
  const raw = readStorageItem(LOCAL_DOC_METADATA_OVERRIDES_STORAGE_KEY)
  if (!raw) return Effect.succeed(new Map<string, LocalDocMetadataOverride>())

  return fromSync(() => {
    const parsed = JSON.parse(raw) as unknown
    const entries = Array.isArray(parsed) ? parsed : Object.entries(parsed as Record<string, unknown>)
    return new Map(
      entries
        .map((entry) => {
          if (!Array.isArray(entry) || typeof entry[0] !== 'string') return null

          const override = normalizeLocalMetadataOverride(entry[1])
          return override ? ([entry[0], override] as const) : null
        })
        .filter((entry): entry is readonly [string, LocalDocMetadataOverride] => entry !== null),
    )
  }).pipe(Effect.catchAll(() => Effect.succeed(new Map<string, LocalDocMetadataOverride>())))
}

function writeLocalMetadataOverrides(overrides: Map<string, LocalDocMetadataOverride>): void {
  if (overrides.size === 0) {
    removeStorageItem(LOCAL_DOC_METADATA_OVERRIDES_STORAGE_KEY)
    return
  }

  writeStorageItem(LOCAL_DOC_METADATA_OVERRIDES_STORAGE_KEY, JSON.stringify(Object.fromEntries(overrides)))
}

function readDeletedFolderIds(): Set<string> {
  return runDesktopSync(readDeletedFolderIdsEffect())
}

function readDeletedFolderIdsEffect(): DesktopEffect<Set<string>> {
  const raw = readStorageItem(DELETED_DOC_FOLDERS_STORAGE_KEY)
  if (!raw) return Effect.succeed(new Set<string>())

  return fromSync(() => {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set<string>()

    return new Set(parsed.map((value) => (typeof value === 'string' ? normalizeFolderId(value) : '')).filter(Boolean))
  }).pipe(Effect.catchAll(() => Effect.succeed(new Set<string>())))
}

function writeDeletedFolderIds(folderIds: Set<string>): void {
  if (folderIds.size === 0) {
    removeStorageItem(DELETED_DOC_FOLDERS_STORAGE_KEY)
    return
  }

  writeStorageItem(DELETED_DOC_FOLDERS_STORAGE_KEY, JSON.stringify([...folderIds]))
}

function isForbiddenMatrixError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false

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
  return (
    matrixError.errcode === 'M_FORBIDDEN' ||
    matrixError.data?.errcode === 'M_FORBIDDEN' ||
    matrixError.httpStatus === 403 ||
    matrixError.statusCode === 403 ||
    matrixError.status === 403 ||
    matrixError.response?.status === 403 ||
    message.includes('M_FORBIDDEN') ||
    message.includes('[403]')
  )
}

function normalizeFolderId(folder?: string): string {
  const normalized = (folder ?? '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/')
  return normalized === ROOT_DOC_FOLDER_NAME ? ROOT_DOC_FOLDER_ID : normalized
}

function isLikelyFolderId(name: string): boolean {
  return (
    /^folder:[0-9a-fA-F-]{6,}$/.test(name) ||
    /^folder:[a-z0-9]+:[a-z0-9]+$/i.test(name) ||
    (name.startsWith('folder:') && name.length > 40)
  )
}

function readableFolderName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  if (!trimmed || isLikelyFolderId(trimmed)) return undefined

  return trimmed
}

function sanitizeFolderName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '新建文件夹'

  if (isLikelyFolderId(trimmed)) return '未命名文件夹'

  return trimmed
}

function createFolderId(): string {
  if (globalThis.crypto?.randomUUID) return `folder:${globalThis.crypto.randomUUID()}`
  return `folder:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`
}

function isRawFolderRecord(value: unknown): value is RawFolderRecord & { id: string } {
  return typeof value === 'object' && value !== null && typeof (value as RawFolderRecord).id === 'string'
}

function resolveFolderRecordName(record: RawFolderRecord): string {
  return (
    [record.name, record.title, record.label, record.folderName]
      .map(readableFolderName)
      .find((name): name is string => name !== undefined) ?? ''
  )
}

function folderNameFromId(id: string): string {
  const segments = normalizeFolderId(id).split('/').filter(Boolean)
  const leaf = readableFolderName(segments.at(-1))
  return leaf ?? '未命名文件夹'
}

function folderNameForMetadataValue(value: unknown): string | undefined {
  const name = readableFolderName(value)
  return name ? sanitizeFolderName(name) : undefined
}

function normalizeFolderRecord(value: unknown): DocFolderRecord | null {
  if (!isRawFolderRecord(value)) return null

  const id = normalizeFolderId(value.id)
  if (!id) return null

  const now = Date.now()
  return {
    id,
    name: sanitizeFolderName(resolveFolderRecordName(value) || folderNameFromId(id)),
    parentId: normalizeFolderId(typeof value.parentId === 'string' ? value.parentId : undefined),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now,
  }
}

function normalizeFolderRecords(value: unknown): DocFolderRecord[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') {
          return {
            id: entry,
            name: entry,
            parentId: ROOT_DOC_FOLDER_ID,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          } as RawFolderRecord
        }

        if (typeof entry === 'object' && entry !== null) {
          const record = entry as RawFolderRecord
          return {
            ...record,
            id: record.id ?? '',
          } as RawFolderRecord
        }

        return null
      })
      .map(normalizeFolderRecord)
      .filter((folder): folder is DocFolderRecord => folder !== null)
  }

  if (value && typeof value === 'object') {
    const rawEntries = value instanceof Map ? [...value.entries()] : Object.entries(value as Record<string, unknown>)

    return rawEntries
      .map(([id, entry]) => {
        if (typeof entry === 'string') {
          return {
            id,
            name: entry,
            parentId: ROOT_DOC_FOLDER_ID,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          } as RawFolderRecord
        }

        if (entry && typeof entry === 'object') {
          const record = { ...(entry as RawFolderRecord), id: id as RawFolderRecord['id'] }
          return record
        }

        return null
      })
      .map((entry) => {
        if (entry === null) return null

        let record = entry
        if (!record.name) {
          const fallbackName =
            typeof record.id === 'string' && record.id.includes('/') ? record.id.split('/').slice(-1)[0] : ''
          if (fallbackName) record = { ...record, name: fallbackName }
        }

        return normalizeFolderRecord(record)
      })
      .filter((folder): folder is DocFolderRecord => folder !== null)
  }

  return []
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

function ensureLegacyFolderPath(
  folderId: string,
  nodesById: Map<string, MutableDocFolderNode>,
  terminalName?: string,
): void {
  const normalized = normalizeFolderId(folderId)
  if (!normalized) return

  let parentId = ROOT_DOC_FOLDER_ID
  let path = ''
  const segments = normalized.split('/').filter(Boolean)
  segments.forEach((segment, index) => {
    path = path ? `${path}/${segment}` : segment
    if (!nodesById.has(path)) {
      const isTerminal = index === segments.length - 1
      const folderName = isTerminal && terminalName ? terminalName : segment
      nodesById.set(path, createFolderNode(path, sanitizeFolderName(folderName), parentId, index + 1, false))
    }
    parentId = path
  })
}

function attachFolderNodes(nodesById: Map<string, MutableDocFolderNode>, root: MutableDocFolderNode): void {
  for (const node of nodesById.values()) {
    node.children = []
  }

  for (const node of nodesById.values()) {
    if (node.id === ROOT_DOC_FOLDER_ID) continue

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
  if (node.id === folderId) return node
  for (const child of node.children) {
    const found = findFolderNode(child, folderId)
    if (found) return found
  }
  return null
}

function collectFolderIds(node: DocFolderNode, folderIds: Set<string>): void {
  folderIds.add(node.id)
  node.children.forEach((child) => collectFolderIds(child, folderIds))
}

function buildFolderTree(
  documents: DocEntry[],
  folders: DocFolderRecord[],
  deletedFolderIds: Set<string>,
): DocFolderNode {
  const root = createFolderNode(ROOT_DOC_FOLDER_ID, ROOT_DOC_FOLDER_NAME, ROOT_DOC_FOLDER_ID, 0, true)
  const nodesById = new Map<string, MutableDocFolderNode>([[ROOT_DOC_FOLDER_ID, root]])

  folders.forEach((folder) => {
    const id = normalizeFolderId(folder.id)
    if (!id || deletedFolderIds.has(id)) return
    const parentId = normalizeFolderId(folder.parentId)
    if (parentId && parentId.includes('/')) ensureLegacyFolderPath(parentId, nodesById)
    nodesById.set(id, createFolderNode(id, sanitizeFolderName(folder.name), parentId, 1, true))
  })

  documents.forEach((doc) => {
    const folderId = normalizeFolderId(doc.folder)
    if (!folderId || deletedFolderIds.has(folderId)) return
    const readableDocFolderName = folderNameForMetadataValue(doc.folderName)
    if (!nodesById.has(folderId)) {
      ensureLegacyFolderPath(folderId, nodesById, readableDocFolderName)
      return
    }

    const node = nodesById.get(folderId)
    if (node && !node.isPersisted && node.name === '未命名文件夹' && readableDocFolderName)
      node.name = readableDocFolderName
  })

  attachFolderNodes(nodesById, root)

  documents.forEach((doc) => {
    root.count += 1
    const folderId = normalizeFolderId(doc.folder)
    if (!folderId || deletedFolderIds.has(folderId)) return

    let node = nodesById.get(folderId)
    while (node && node.id !== ROOT_DOC_FOLDER_ID) {
      node.count += 1
      node = nodesById.get(node.parentId)
    }
  })

  sortFolderTree(root)
  return root
}

function deriveDocumentSectionIds(
  sectionIds: DocSectionId[] | undefined,
  owner: string,
  currentUserId: string | null,
): DocSectionId[] {
  const sections = new Set<DocSectionId>(sectionIds?.length ? sectionIds : ['recent'])
  if (currentUserId && owner && owner !== currentUserId) sections.add('shared')
  return [...sections]
}

function warnEffect(message: string, error: unknown): DesktopEffect<void> {
  return fromSync(() => console.warn(message, error))
}

function ignoreForbiddenMatrixErrorEffect(message: string, error: unknown): DesktopEffect<void> {
  return isForbiddenMatrixError(error) ? warnEffect(message, error) : Effect.fail(error)
}

export const useDocsStore = defineStore('docs', () => {
  const documents = shallowRef<DocEntry[]>([])
  const folders = shallowRef<DocFolderRecord[]>([])
  const activeSection = shallowRef<DocSectionId>('recent')
  const activeFolder = shallowRef(ROOT_DOC_FOLDER_ID)
  const searchQuery = shallowRef('')
  const reviewOnly = shallowRef(false)
  const isLoading = shallowRef(false)
  const localMetadataOverrides = readLocalMetadataOverrides()
  const deletedFolderIds = shallowRef(readDeletedFolderIds())

  const folderTree = computed(() => buildFolderTree(documents.value, folders.value, deletedFolderIds.value))
  const selectedFolderIds = computed(() => {
    const folderId = normalizeFolderId(activeFolder.value)
    if (!folderId) return null

    const node = findFolderNode(folderTree.value, folderId)
    if (!node) return new Set([folderId])

    const folderIds = new Set<string>()
    collectFolderIds(node, folderIds)
    return folderIds
  })

  function resolveFolderNameForMetadata(folderId: string, fallback?: unknown): string | undefined {
    const normalizedFolderId = normalizeFolderId(folderId)
    if (!normalizedFolderId) return undefined

    const readableFallback = folderNameForMetadataValue(fallback)
    if (readableFallback) return readableFallback

    return folderNameForMetadataValue(findFolderNode(folderTree.value, normalizedFolderId)?.name)
  }

  function mergeLocalOverride(roomId: string, content: DocMetadataContent): DocMetadataContent {
    const override = localMetadataOverrides.get(roomId)
    if (!override) return content

    const titleSynced = !override.title || content.title === override.title
    const folderSynced = override.folder === undefined || normalizeFolderId(content.folder) === override.folder
    const folderNameSynced = !override.folderName || content.folderName === override.folderName
    if ((titleSynced && folderSynced && folderNameSynced) || getMetadataTimestamp(content) > override.updatedAt) {
      localMetadataOverrides.delete(roomId)
      writeLocalMetadataOverrides(localMetadataOverrides)
      return content
    }

    return {
      ...content,
      title: override.title ?? content.title,
      folder: override.folder ?? content.folder,
      folderName: override.folderName ?? content.folderName,
      updated: override.updated,
      updatedAt: override.updatedAt,
    }
  }

  function updateLocalMetadataOverride(
    docId: string,
    patch: Partial<LocalDocMetadataOverride> & Pick<LocalDocMetadataOverride, 'updated' | 'updatedAt'>,
  ): void {
    localMetadataOverrides.set(docId, {
      ...(localMetadataOverrides.get(docId) ?? {}),
      ...patch,
    })
    writeLocalMetadataOverrides(localMetadataOverrides)
  }

  function rememberDeletedFolderIds(folderIds: Set<string>): void {
    const next = new Set(deletedFolderIds.value)
    folderIds.forEach((folderId) => {
      const normalized = normalizeFolderId(folderId)
      if (normalized) next.add(normalized)
    })
    deletedFolderIds.value = next
    writeDeletedFolderIds(next)
  }

  function forgetDeletedFolderId(folderId: string): void {
    const normalized = normalizeFolderId(folderId)
    if (!normalized || !deletedFolderIds.value.has(normalized)) return

    const next = new Set(deletedFolderIds.value)
    next.delete(normalized)
    deletedFolderIds.value = next
    writeDeletedFolderIds(next)
  }

  const filteredDocuments = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    return documents.value.filter((doc) => {
      const matchesQuery = !query || doc.title.toLowerCase().includes(query) || doc.owner.toLowerCase().includes(query)
      const matchesSection = doc.sectionIds.includes(activeSection.value)
      const matchesFolder =
        selectedFolderIds.value === null || selectedFolderIds.value.has(normalizeFolderId(doc.folder))
      const matchesReview = !reviewOnly.value || doc.status === '评审中'
      return matchesSection && matchesFolder && matchesQuery && matchesReview
    })
  })

  function persistFoldersEffect(): DesktopEffect<void> {
    const client = getClient() as unknown as MatrixDocAccountClient
    return fromPromise(
      () => client.setAccountData?.(MATRIX_EVENT_TYPES.DOC_FOLDERS, { folders: folders.value }) ?? Promise.resolve(),
    ).pipe(
      Effect.catchAll((err) =>
        ignoreForbiddenMatrixErrorEffect('[Docs] Cannot persist folder tree account data:', err),
      ),
    )
  }

  function sendDocMetadataEventEffect(docId: string, content: DocMetadataContent): DesktopEffect<void> {
    const client = getClient() as unknown as MatrixDocMetadataClient
    return Effect.gen(function* () {
      const stateResult = yield* fromPromise(() =>
        client.sendStateEvent(docId, MATRIX_EVENT_TYPES.DOC_METADATA, content),
      ).pipe(
        Effect.as('state' as const),
        Effect.catchAll((err) => {
          if (!isForbiddenMatrixError(err)) return Effect.fail(err)

          return Effect.gen(function* () {
            if (!client.sendEvent) {
              yield* warnEffect('[Docs] Cannot persist document metadata state event:', err)
              return 'done' as const
            }

            yield* warnEffect('[Docs] Falling back to timeline metadata event:', err)
            return 'fallback' as const
          })
        }),
      )

      if (stateResult !== 'fallback') return

      yield* fromPromise(() => client.sendEvent!(docId, MATRIX_EVENT_TYPES.DOC_METADATA, content)).pipe(
        Effect.catchAll((err) =>
          ignoreForbiddenMatrixErrorEffect('[Docs] Cannot persist document metadata timeline event:', err),
        ),
      )
    })
  }

  function setDocumentRoomNameEffect(docId: string, title: string): DesktopEffect<void> {
    const client = getClient() as unknown as MatrixDocMetadataClient
    return fromPromise(() => client.setRoomName?.(docId, title) ?? Promise.resolve()).pipe(
      Effect.catchAll((err) => ignoreForbiddenMatrixErrorEffect('[Docs] Cannot update document room name:', err)),
    )
  }

  function loadFoldersEffect(): DesktopEffect<void> {
    return Effect.gen(function* () {
      const client = getClient() as unknown as MatrixDocAccountClient
      const nextFolders = yield* fromSync(() => {
        const content = client.getAccountData?.(MATRIX_EVENT_TYPES.DOC_FOLDERS)?.getContent()
        return normalizeFolderRecords(content?.folders).filter((folder) => !deletedFolderIds.value.has(folder.id))
      })
      folders.value = nextFolders
    }).pipe(Effect.catchAll(() => fromSync(() => void (folders.value = []))))
  }

  function loadFolders(): Promise<void> {
    return runDesktopEffect(loadFoldersEffect())
  }

  function loadDocumentsEffect(): DesktopEffect<void> {
    return Effect.gen(function* () {
      yield* fromSync(() => void (isLoading.value = true))
      const client = getClient()
      const nextDocuments = yield* fromSync(() => {
        const currentUserId = client.getUserId()
        const rooms = client.getRooms()
        const docRooms = rooms.filter((r) => {
          return !!getDocMetadataEvent(r as MatrixDocRoom)
        })

        return docRooms.map((room) => {
          const metaEvent = getDocMetadataEvent(room as MatrixDocRoom)
          const content = mergeLocalOverride(room.roomId, metaEvent?.getContent() ?? {})
          const owner = content.owner || '未知'
          const folder = normalizeFolderId(content.folder)
          return {
            id: room.roomId,
            title: content.title || '无标题文档',
            owner,
            updated: content.updated || '',
            type: content.type || '文档',
            status: content.status || '草稿',
            folder,
            folderName: resolveFolderNameForMetadata(folder, content.folderName),
            sectionIds: deriveDocumentSectionIds(content.sectionIds, owner, currentUserId),
          }
        })
      })
      documents.value = nextDocuments
    }).pipe(
      Effect.catchAll(() => fromSync(() => void (documents.value = []))),
      Effect.ensuring(Effect.sync(() => void (isLoading.value = false))),
    )
  }

  function loadDocuments(): Promise<void> {
    return runDesktopEffect(loadDocumentsEffect())
  }

  function createDocumentEffect(title: string, folder: string): DesktopEffect<string> {
    const client = getClient()
    const now = Date.now()
    const owner = client.getUserId()!
    const folderId = normalizeFolderId(folder)
    const folderName = resolveFolderNameForMetadata(folderId)
    const metadataContent: DocMetadataContent = {
      title,
      owner,
      updated: '刚刚',
      type: '文档',
      status: '草稿',
      folder: folderId,
      folderName,
      sectionIds: ['recent'],
      createdAt: now,
    }
    return Effect.gen(function* () {
      const result = yield* fromPromise(() =>
        client.createRoom({
          name: title,
          visibility: Visibility.Private,
          initial_state: [
            {
              type: MATRIX_EVENT_TYPES.DOC_METADATA,
              content: metadataContent,
            },
          ],
        }),
      ).pipe(
        Effect.catchAll((err) => {
          if (!isForbiddenMatrixError(err)) return Effect.fail(err)

          return Effect.gen(function* () {
            const fallbackResult = yield* fromPromise(() =>
              client.createRoom({
                name: title,
                visibility: Visibility.Private,
              }),
            )
            yield* sendDocMetadataEventEffect(fallbackResult.room_id, metadataContent)
            return fallbackResult
          })
        }),
      )
      const createdDoc: DocEntry = {
        id: result.room_id,
        title,
        owner,
        updated: '刚刚',
        type: '文档',
        status: '草稿',
        folder: folderId,
        folderName,
        sectionIds: ['recent'],
      }
      yield* loadDocumentsEffect()
      yield* fromSync(() => {
        if (!documents.value.some((doc) => doc.id === createdDoc.id)) {
          documents.value = [createdDoc, ...documents.value]
        }
      })
      return result.room_id
    })
  }

  function createDocument(title: string, folder: string): Promise<string> {
    return runDesktopEffect(createDocumentEffect(title, folder))
  }

  function appendMarkdownEffect(docId: string, markdown: string): DesktopEffect<void> {
    return Effect.gen(function* () {
      const trimmed = markdown.trim()
      if (!trimmed) return
      // Imported markdown should land in the doc room without paging every member.
      yield* fromPromise(() => sendTextMessage(docId, trimmed, undefined, { silent: true }))
    })
  }

  function appendMarkdown(docId: string, markdown: string): Promise<void> {
    return runDesktopEffect(appendMarkdownEffect(docId, markdown))
  }

  function updateDocumentTitleEffect(docId: string, title: string): DesktopEffect<void> {
    return Effect.gen(function* () {
      const { nextTitle, nextContent, now } = yield* fromSync(() => {
        const nextTitle = title.trim() || '无标题文档'
        const now = Date.now()
        const client = getClient()
        const existing = documents.value.find((doc) => doc.id === docId)
        const room = client.getRoom(docId)
        const metaEvent = room ? getDocMetadataEvent(room as MatrixDocRoom) : undefined
        const currentContent = metaEvent?.getContent() ?? {}
        const folder = normalizeFolderId(currentContent.folder || existing?.folder)
        const nextContent = {
          ...currentContent,
          title: nextTitle,
          owner: currentContent.owner || existing?.owner || client.getUserId() || '未知',
          updated: '刚刚',
          type: currentContent.type || existing?.type || '文档',
          status: currentContent.status || existing?.status || '草稿',
          folder,
          folderName: resolveFolderNameForMetadata(folder, currentContent.folderName || existing?.folderName),
          sectionIds: currentContent.sectionIds || existing?.sectionIds || ['recent'],
          updatedAt: now,
          createdAt: currentContent.createdAt || now,
        }
        return { nextTitle, nextContent, now }
      })

      yield* sendDocMetadataEventEffect(docId, nextContent)
      yield* setDocumentRoomNameEffect(docId, nextTitle)

      yield* fromSync(() => {
        updateLocalMetadataOverride(docId, {
          title: nextTitle,
          updated: '刚刚',
          updatedAt: now,
        })

        documents.value = documents.value.map((doc) =>
          doc.id === docId
            ? {
                ...doc,
                title: nextTitle,
                updated: '刚刚',
                type: nextContent.type,
                status: nextContent.status,
                folder: nextContent.folder,
                folderName: nextContent.folderName,
                sectionIds: nextContent.sectionIds,
              }
            : doc,
        )
      })
    })
  }

  function updateDocumentTitle(docId: string, title: string): Promise<void> {
    return runDesktopEffect(updateDocumentTitleEffect(docId, title))
  }

  function updateDocumentFolderEffect(docId: string, folder: string): DesktopEffect<void> {
    return Effect.gen(function* () {
      const { nextFolder, nextFolderName, nextContent, now } = yield* fromSync(() => {
        const nextFolder = normalizeFolderId(folder)
        const nextFolderName = resolveFolderNameForMetadata(nextFolder)
        const now = Date.now()
        const client = getClient()
        const existing = documents.value.find((doc) => doc.id === docId)
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
          folderName: nextFolderName,
          sectionIds: currentContent.sectionIds || existing?.sectionIds || ['recent'],
          updatedAt: now,
          createdAt: currentContent.createdAt || now,
        }
        return { nextFolder, nextFolderName, nextContent, now }
      })

      yield* sendDocMetadataEventEffect(docId, nextContent)

      yield* fromSync(() => {
        updateLocalMetadataOverride(docId, {
          folder: nextFolder,
          folderName: nextFolderName,
          updated: '刚刚',
          updatedAt: now,
        })

        documents.value = documents.value.map((doc) =>
          doc.id === docId
            ? {
                ...doc,
                updated: '刚刚',
                type: nextContent.type,
                status: nextContent.status,
                folder: nextFolder,
                folderName: nextFolderName,
                sectionIds: nextContent.sectionIds,
              }
            : doc,
        )
      })
    })
  }

  function updateDocumentFolder(docId: string, folder: string): Promise<void> {
    return runDesktopEffect(updateDocumentFolderEffect(docId, folder))
  }

  function setDocumentStarredEffect(docId: string, starred: boolean): DesktopEffect<void> {
    return Effect.gen(function* () {
      const { nextContent, sectionIds } = yield* fromSync(() => {
        const now = Date.now()
        const client = getClient()
        const existing = documents.value.find((doc) => doc.id === docId)
        const room = client.getRoom(docId)
        const metaEvent = room ? getDocMetadataEvent(room as MatrixDocRoom) : undefined
        const currentContent = metaEvent?.getContent() ?? {}
        const currentSections = new Set<DocSectionId>(currentContent.sectionIds || existing?.sectionIds || ['recent'])

        if (starred) currentSections.add('starred')
        else currentSections.delete('starred')

        if (currentSections.size === 0) currentSections.add('recent')

        const sectionIds = [...currentSections]
        const folder = normalizeFolderId(existing?.folder || currentContent.folder)
        const nextContent = {
          ...currentContent,
          title: existing?.title || currentContent.title || '无标题文档',
          owner: currentContent.owner || existing?.owner || client.getUserId() || '未知',
          updated: '刚刚',
          type: currentContent.type || existing?.type || '文档',
          status: currentContent.status || existing?.status || '草稿',
          folder,
          folderName: resolveFolderNameForMetadata(folder, existing?.folderName || currentContent.folderName),
          sectionIds,
          updatedAt: now,
          createdAt: currentContent.createdAt || now,
        }
        return { nextContent, sectionIds }
      })

      yield* sendDocMetadataEventEffect(docId, nextContent)

      yield* fromSync(() => {
        documents.value = documents.value.map((doc) =>
          doc.id === docId
            ? {
                ...doc,
                updated: '刚刚',
                type: nextContent.type,
                status: nextContent.status,
                folder: nextContent.folder,
                folderName: nextContent.folderName,
                sectionIds,
              }
            : doc,
        )
      })
    })
  }

  function setDocumentStarred(docId: string, starred: boolean): Promise<void> {
    return runDesktopEffect(setDocumentStarredEffect(docId, starred))
  }

  function setDocumentStatusEffect(docId: string, status: DocEntry['status']): DesktopEffect<void> {
    return Effect.gen(function* () {
      const nextContent = yield* fromSync(() => {
        const now = Date.now()
        const client = getClient()
        const existing = documents.value.find((doc) => doc.id === docId)
        const room = client.getRoom(docId)
        const metaEvent = room ? getDocMetadataEvent(room as MatrixDocRoom) : undefined
        const currentContent = metaEvent?.getContent() ?? {}
        const folder = normalizeFolderId(existing?.folder || currentContent.folder)
        return {
          ...currentContent,
          title: existing?.title || currentContent.title || '无标题文档',
          owner: currentContent.owner || existing?.owner || client.getUserId() || '未知',
          updated: '刚刚',
          type: currentContent.type || existing?.type || '文档',
          status,
          folder,
          folderName: resolveFolderNameForMetadata(folder, existing?.folderName || currentContent.folderName),
          sectionIds: currentContent.sectionIds || existing?.sectionIds || ['recent'],
          updatedAt: now,
          createdAt: currentContent.createdAt || now,
        }
      })

      yield* sendDocMetadataEventEffect(docId, nextContent)

      yield* fromSync(() => {
        documents.value = documents.value.map((doc) =>
          doc.id === docId
            ? {
                ...doc,
                updated: '刚刚',
                type: nextContent.type,
                status,
                folder: nextContent.folder,
                folderName: nextContent.folderName,
                sectionIds: nextContent.sectionIds,
              }
            : doc,
        )
      })
    })
  }

  function setDocumentStatus(docId: string, status: DocEntry['status']): Promise<void> {
    return runDesktopEffect(setDocumentStatusEffect(docId, status))
  }

  function deleteDocumentEffect(docId: string): DesktopEffect<void> {
    return Effect.gen(function* () {
      const client = getClient()
      yield* fromPromise(() => client.leave(docId))
      yield* fromSync(() => {
        localMetadataOverrides.delete(docId)
        writeLocalMetadataOverrides(localMetadataOverrides)
        documents.value = documents.value.filter((doc) => doc.id !== docId)
      })
    })
  }

  function deleteDocument(docId: string): Promise<void> {
    return runDesktopEffect(deleteDocumentEffect(docId))
  }

  function createFolderEffect(name: string, parentId = activeFolder.value): DesktopEffect<string> {
    return Effect.gen(function* () {
      const folder = yield* fromSync(() => {
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
        forgetDeletedFolderId(folder.id)
        return folder
      })
      yield* persistFoldersEffect()
      return folder.id
    })
  }

  function createFolder(name: string, parentId = activeFolder.value): Promise<string> {
    return runDesktopEffect(createFolderEffect(name, parentId))
  }

  function renameFolderEffect(folderId: string, name: string): DesktopEffect<void> {
    return Effect.gen(function* () {
      const targetFolderId = normalizeFolderId(folderId)
      if (!targetFolderId) return

      yield* fromSync(() => {
        const nextName = sanitizeFolderName(name)
        const now = Date.now()
        const existingFolder = folders.value.find((folder) => folder.id === targetFolderId)
        forgetDeletedFolderId(targetFolderId)
        if (existingFolder) {
          folders.value = folders.value.map((folder) =>
            folder.id === targetFolderId ? { ...folder, name: nextName, updatedAt: now } : folder,
          )
          return
        }

        const node = findFolderNode(folderTree.value, targetFolderId)
        folders.value = [
          ...folders.value,
          {
            id: targetFolderId,
            name: nextName,
            parentId: normalizeFolderId(node?.parentId),
            createdAt: now,
            updatedAt: now,
          },
        ]
      })
      yield* persistFoldersEffect()
    })
  }

  function renameFolder(folderId: string, name: string): Promise<void> {
    return runDesktopEffect(renameFolderEffect(folderId, name))
  }

  function deleteFolderEffect(folderId: string): DesktopEffect<void> {
    return Effect.gen(function* () {
      const deleteContext = yield* fromSync(() => {
        const targetFolderId = normalizeFolderId(folderId)
        if (!targetFolderId) return null

        const node = findFolderNode(folderTree.value, targetFolderId)
        if (!node) return null

        const folderIds = new Set<string>()
        collectFolderIds(node, folderIds)
        const documentsToMove = documents.value.filter((doc) => folderIds.has(normalizeFolderId(doc.folder)))
        return { targetFolderId, folderIds, documentsToMove }
      })
      if (!deleteContext) return

      yield* Effect.all(
        deleteContext.documentsToMove.map((doc) => updateDocumentFolderEffect(doc.id, ROOT_DOC_FOLDER_ID)),
      )
      yield* fromSync(() => {
        rememberDeletedFolderIds(deleteContext.folderIds)
        folders.value = folders.value.filter((folder) => !deleteContext.folderIds.has(folder.id))
        if (selectedFolderIds.value?.has(deleteContext.targetFolderId)) activeFolder.value = ROOT_DOC_FOLDER_ID
      })
      yield* persistFoldersEffect()
    })
  }

  function deleteFolder(folderId: string): Promise<void> {
    return runDesktopEffect(deleteFolderEffect(folderId))
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
    persistFoldersEffect,
    sendDocMetadataEventEffect,
    setDocumentRoomNameEffect,
    loadFoldersEffect,
    loadDocumentsEffect,
    createDocumentEffect,
    appendMarkdownEffect,
    updateDocumentTitleEffect,
    updateDocumentFolderEffect,
    setDocumentStarredEffect,
    setDocumentStatusEffect,
    deleteDocumentEffect,
    createFolderEffect,
    renameFolderEffect,
    deleteFolderEffect,
    loadFolders,
    loadDocuments,
    createDocument,
    appendMarkdown,
    updateDocumentTitle,
    updateDocumentFolder,
    setDocumentStarred,
    setDocumentStatus,
    deleteDocument,
    createFolder,
    renameFolder,
    deleteFolder,
  }
})

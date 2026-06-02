import type { EntityTable } from 'dexie'
import Dexie from 'dexie'

export const DOCS_DB_NAME = 'MuonDocsDB'

/**
 * 文档版本快照。以 ProseMirror JSON 存储某一时刻的文档内容（高保真、可经
 * editor.setContent 精确恢复），按设备本地持久化（IndexedDB），跨会话保留。
 */
export interface DocVersion {
  id: string
  docId: string
  /** 版本标签（用户填写或自动生成） */
  label: string
  /** 作者展示名 */
  author: string
  /** ProseMirror JSON（JSON.stringify 后的字符串） */
  contentJson: string
  createdAt: number
}

export const DOCS_DB_STORES = {
  docVersions: 'id, docId, createdAt, [docId+createdAt]',
} as const

export class MuonDocsDB extends Dexie {
  docVersions!: EntityTable<DocVersion, 'id'>

  constructor() {
    super(DOCS_DB_NAME)
    this.version(1).stores(DOCS_DB_STORES)
  }
}

let dbInstance: MuonDocsDB | null = null

function db(): MuonDocsDB {
  dbInstance ??= new MuonDocsDB()
  return dbInstance
}

export const docsRepo = {
  async saveVersion(version: DocVersion): Promise<DocVersion> {
    await db().docVersions.put(version)
    return version
  },
  async listVersions(docId: string): Promise<DocVersion[]> {
    const versions = await db().docVersions.where('docId').equals(docId).toArray()
    return versions.sort((a, b) => b.createdAt - a.createdAt)
  },
  async getVersion(id: string): Promise<DocVersion | undefined> {
    return db().docVersions.get(id)
  },
  async deleteVersion(id: string): Promise<void> {
    await db().docVersions.delete(id)
  },
}

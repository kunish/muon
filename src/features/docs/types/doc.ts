export interface DocComment {
  id: string
  userId: string
  text: string
  /** ProseMirror 选区范围，null 表示全文评论 */
  selection: { from: number, to: number } | null
  resolved: boolean
  createdAt: number
}

/** 本地光标状态，用于 Tiptap CollaborationCursor 渲染 */
export interface CursorData {
  userId: string
  name: string
  color: string
  from: number
  to: number
}

export interface DocMetadata {
  /** Unix 毫秒时间戳 */
  createdAt: number
  updatedAt: number
  createdBy: string
  folder: string
}

export type DocSectionId = 'recent' | 'starred' | 'shared'

export interface DocEntry {
  /** 文档 ID，同时是 Matrix 房间 ID */
  id: string
  title: string
  owner: string
  /** 显示用更新时间，如 "刚刚"、"昨天" */
  updated: string
  type: string
  status: '草稿' | '进行中' | '评审中' | '稳定'
  folder: string
  sectionIds: DocSectionId[]
}

export interface DocSyncEvent {
  type: 'full' | 'delta'
  docId: string
  seq: number
  total: number
  /** Base64 编码的 Yjs 增量更新 */
  payload: string
  /** 前一条事件的 ID，用于检测丢包 */
  prevEventId: string | null
}

export interface DocCursorEvent {
  userId: string
  name: string
  color: string
  from: number
  to: number
}

export const MATRIX_EVENT_TYPES = {
  DOC_SYNC: 'org.muon.doc.sync',
  DOC_CURSOR: 'org.muon.doc.cursor',
  DOC_METADATA: 'org.muon.doc.metadata',
} as const

export function userColor(userId: string): string {
  const colors = [
    '#2563eb', '#dc2626', '#16a34a', '#ca8a04',
    '#9333ea', '#0891b2', '#db2777', '#ea580c',
  ]
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
    hash |= 0
  }
  return colors[Math.abs(hash) % colors.length]
}

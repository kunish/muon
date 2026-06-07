export const MINUTES_STORAGE_KEY = 'muon.minutes.records.v1'

/** 会议行动项（纪要内嵌的轻量待办，区别于消息派生的 chat task）。 */
export interface ActionItem {
  id: string
  text: string
  /** 负责人，默认「我」 */
  assignee: string
  done: boolean
}

export interface Minute {
  id: string
  title: string
  /** 会议日期 YYYY-MM-DD */
  date: string
  /** 参会人（自由文本，逗号分隔） */
  attendees: string
  /** 议题 */
  agenda?: string
  /** 决议 */
  decisions?: string
  /** 纪要正文 / 备注 */
  notes?: string
  actionItems: ActionItem[]
  /** 创建时间戳（毫秒），用于稳定排序 */
  createdAt: number
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidActionItem(value: unknown): value is ActionItem {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ActionItem>
  return (
    typeof candidate.id === 'string' &&
    !!candidate.id &&
    typeof candidate.text === 'string' &&
    typeof candidate.assignee === 'string' &&
    typeof candidate.done === 'boolean'
  )
}

export function isValidMinute(value: unknown): value is Minute {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Minute>
  return (
    typeof candidate.id === 'string' &&
    !!candidate.id &&
    typeof candidate.title === 'string' &&
    typeof candidate.date === 'string' &&
    DATE_RE.test(candidate.date) &&
    typeof candidate.attendees === 'string' &&
    (candidate.agenda === undefined || typeof candidate.agenda === 'string') &&
    (candidate.decisions === undefined || typeof candidate.decisions === 'string') &&
    (candidate.notes === undefined || typeof candidate.notes === 'string') &&
    Array.isArray(candidate.actionItems) &&
    candidate.actionItems.every(isValidActionItem) &&
    typeof candidate.createdAt === 'number'
  )
}

export function isValidMinuteDate(value: string): boolean {
  return DATE_RE.test(value)
}

/** 未完成行动项数量。 */
export function openActionCount(minute: Minute): number {
  return minute.actionItems.filter((item) => !item.done).length
}

/** 本地今天的日期键 YYYY-MM-DD。 */
export function todayKey(now: number): string {
  const date = new Date(now)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function generateMinuteId(now: number): string {
  return `minute:${now}:${Math.random().toString(36).slice(2, 10)}`
}

export function generateActionItemId(now: number): string {
  return `action:${now}:${Math.random().toString(36).slice(2, 10)}`
}

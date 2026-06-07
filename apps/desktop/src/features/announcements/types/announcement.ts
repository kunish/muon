// 组织级公告（全员通知板），区别于 features/contacts 的「群公告」（房间内 m.room state）。
export const ANNOUNCEMENTS_STORAGE_KEY = 'muon.announcements.v1'

export interface Announcement {
  id: string
  title: string
  body: string
  author: string
  pinned: boolean
  /** 当前用户是否已读（本地单用户模型：新公告默认未读，展开即已读） */
  read: boolean
  createdAt: number
}

export function isValidAnnouncement(value: unknown): value is Announcement {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Announcement>
  return (
    typeof candidate.id === 'string' &&
    !!candidate.id &&
    typeof candidate.title === 'string' &&
    typeof candidate.body === 'string' &&
    typeof candidate.author === 'string' &&
    typeof candidate.pinned === 'boolean' &&
    typeof candidate.read === 'boolean' &&
    typeof candidate.createdAt === 'number'
  )
}

/** 未读公告数。 */
export function unreadCount(announcements: Announcement[]): number {
  return announcements.filter((item) => !item.read).length
}

/** 置顶在前，其次按创建时间倒序。 */
export function compareAnnouncements(a: Announcement, b: Announcement): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  return b.createdAt - a.createdAt
}

export function generateAnnouncementId(now: number): string {
  return `announcement:${now}:${Math.random().toString(36).slice(2, 10)}`
}

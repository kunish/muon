import { beforeEach, describe, expect, it } from 'vitest'
import {
  addAnnouncement,
  announcementStore,
  markAllRead,
  markRead,
  removeAnnouncement,
  resetAnnouncementStore,
  togglePin,
  updateAnnouncement,
} from '@/features/announcements/stores/announcementStore'
import {
  ANNOUNCEMENTS_STORAGE_KEY,
  compareAnnouncements,
  unreadCount,
} from '@/features/announcements/types/announcement'

function onlyAnnouncement() {
  return announcementStore.state.announcements[0]
}

describe('announcementStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetAnnouncementStore()
  })

  it('starts empty without any seeded mock announcements', () => {
    expect(announcementStore.state.announcements).toEqual([])
  })

  it('creates an announcement that defaults to unread with author 我', () => {
    const announcement = addAnnouncement({ id: 'a-1', title: '春节放假通知', body: '放假 7 天' })

    expect(announcement.author).toBe('我')
    expect(announcement.read).toBe(false)
    expect(announcement.pinned).toBe(false)

    resetAnnouncementStore()
    expect(onlyAnnouncement()).toMatchObject({ id: 'a-1', title: '春节放假通知', body: '放假 7 天' })
  })

  it('rejects an announcement with an empty title', () => {
    expect(() => addAnnouncement({ title: '   ', body: 'x' })).toThrow()
    expect(announcementStore.state.announcements).toEqual([])
  })

  it('marks a single announcement read and reflects the unread count', () => {
    addAnnouncement({ id: 'a-2', title: '通知', body: 'x' })
    expect(unreadCount(announcementStore.state.announcements)).toBe(1)

    markRead('a-2')
    expect(unreadCount(announcementStore.state.announcements)).toBe(0)

    resetAnnouncementStore()
    expect(onlyAnnouncement().read).toBe(true)
  })

  it('marks all announcements read', () => {
    addAnnouncement({ id: 'a-3', title: 'A', body: '' })
    addAnnouncement({ id: 'a-4', title: 'B', body: '' })
    expect(unreadCount(announcementStore.state.announcements)).toBe(2)

    markAllRead()
    expect(unreadCount(announcementStore.state.announcements)).toBe(0)
  })

  it('toggles pin and persists it', () => {
    addAnnouncement({ id: 'a-5', title: '置顶通知', body: '' })
    togglePin('a-5')

    resetAnnouncementStore()
    expect(onlyAnnouncement().pinned).toBe(true)
  })

  it('sorts pinned announcements before others, then by recency', () => {
    const first = addAnnouncement({ id: 'old', title: '早', body: '', now: 1000 })
    const second = addAnnouncement({ id: 'new', title: '晚', body: '', now: 2000 })
    togglePin(first.id)

    const order = [...announcementStore.state.announcements].sort(compareAnnouncements).map((item) => item.id)
    expect(order).toEqual(['old', 'new'])
    void second
  })

  it('updates an announcement body', () => {
    addAnnouncement({ id: 'a-6', title: '通知', body: '初稿' })
    updateAnnouncement('a-6', { body: '终稿' })

    resetAnnouncementStore()
    expect(onlyAnnouncement().body).toBe('终稿')
  })

  it('removes an announcement and persists the removal', () => {
    addAnnouncement({ id: 'a-7', title: '临时通知', body: '' })
    removeAnnouncement('a-7')

    resetAnnouncementStore()
    expect(announcementStore.state.announcements).toEqual([])
  })

  it('drops invalid persisted announcements when hydrating', () => {
    localStorage.setItem(
      ANNOUNCEMENTS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        announcements: [
          { id: 'good', title: 'Valid', body: 'x', author: '我', pinned: false, read: false, createdAt: 1 },
          { id: 'bad', title: 'Broken', body: 'x', author: '我', pinned: 'no', read: false, createdAt: 2 },
        ],
      }),
    )

    resetAnnouncementStore()
    expect(announcementStore.state.announcements).toHaveLength(1)
    expect(announcementStore.state.announcements[0].id).toBe('good')
  })
})

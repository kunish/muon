import { beforeEach, describe, expect, it } from 'vitest'
import {
  addActionItem,
  addMinute,
  minuteStore,
  removeActionItem,
  removeMinute,
  resetMinuteStore,
  toggleActionItem,
  updateActionItem,
  updateMinute,
} from '@/features/minutes/stores/minuteStore'
import { MINUTES_STORAGE_KEY, openActionCount } from '@/features/minutes/types/minute'

function onlyMinute() {
  return minuteStore.state.minutes[0]
}

describe('minuteStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetMinuteStore()
  })

  it('starts empty without any seeded mock minutes', () => {
    expect(minuteStore.state.minutes).toEqual([])
  })

  it('persists a created minute across a reload', () => {
    const minute = addMinute({ id: 'm-1', title: '迭代评审', date: '2026-06-07', attendees: '客户端团队' })

    expect(minute.actionItems).toEqual([])
    expect(minuteStore.state.minutes).toHaveLength(1)

    resetMinuteStore()
    expect(onlyMinute()).toMatchObject({ id: 'm-1', title: '迭代评审', date: '2026-06-07', attendees: '客户端团队' })
  })

  it('defaults attendees to 我 when none provided', () => {
    const minute = addMinute({ title: '临时同步', date: '2026-06-07' })
    expect(minute.attendees).toBe('我')
  })

  it('rejects a minute with an empty title', () => {
    expect(() => addMinute({ title: '   ', date: '2026-06-07' })).toThrow()
    expect(minuteStore.state.minutes).toEqual([])
  })

  it('rejects a minute with an invalid date', () => {
    expect(() => addMinute({ title: '评审', date: '2026/06/07' })).toThrow()
    expect(minuteStore.state.minutes).toEqual([])
  })

  it('updates sections and clears them when blanked', () => {
    addMinute({ id: 'm-2', title: '评审', date: '2026-06-07', agenda: '讨论范围' })
    expect(onlyMinute().agenda).toBe('讨论范围')

    updateMinute('m-2', { decisions: '本周冻结', agenda: '   ' })
    expect(onlyMinute().decisions).toBe('本周冻结')
    expect(onlyMinute().agenda).toBeUndefined()
  })

  it('adds, toggles, and counts action items', () => {
    addMinute({ id: 'm-3', title: '评审', date: '2026-06-07' })
    addActionItem('m-3', '补齐权限模型', '安全团队')
    addActionItem('m-3', '灰度发布', '发布团队')

    expect(onlyMinute().actionItems).toHaveLength(2)
    expect(onlyMinute().actionItems[0].assignee).toBe('安全团队')
    expect(openActionCount(onlyMinute())).toBe(2)

    const firstId = onlyMinute().actionItems[0].id
    toggleActionItem('m-3', firstId)
    expect(openActionCount(onlyMinute())).toBe(1)
  })

  it('ignores a blank action item', () => {
    addMinute({ id: 'm-4', title: '评审', date: '2026-06-07' })
    addActionItem('m-4', '   ')
    expect(onlyMinute().actionItems).toEqual([])
  })

  it('updates and removes an action item, persisting both', () => {
    addMinute({ id: 'm-5', title: '评审', date: '2026-06-07' })
    addActionItem('m-5', '初稿')
    const itemId = onlyMinute().actionItems[0].id

    updateActionItem('m-5', itemId, { text: '终稿', assignee: '我' })
    resetMinuteStore()
    expect(onlyMinute().actionItems[0].text).toBe('终稿')

    removeActionItem('m-5', itemId)
    resetMinuteStore()
    expect(onlyMinute().actionItems).toEqual([])
  })

  it('removes a minute and persists the removal', () => {
    addMinute({ id: 'm-6', title: '临时纪要', date: '2026-06-07' })
    removeMinute('m-6')

    resetMinuteStore()
    expect(minuteStore.state.minutes).toEqual([])
  })

  it('drops invalid persisted minutes when hydrating', () => {
    localStorage.setItem(
      MINUTES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        minutes: [
          { id: 'good', title: 'Valid', date: '2026-06-07', attendees: '我', actionItems: [], createdAt: 1 },
          { id: 'bad', title: 'Broken', date: 'not-a-date', attendees: '我', actionItems: [], createdAt: 2 },
        ],
      }),
    )

    resetMinuteStore()
    expect(minuteStore.state.minutes).toHaveLength(1)
    expect(minuteStore.state.minutes[0].id).toBe('good')
  })
})

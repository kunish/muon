import { beforeEach, describe, expect, it } from 'vitest'
import {
  attendanceStore,
  clockIn,
  clockOut,
  removeRecord,
  resetAttendanceStore,
  setRecord,
  updateSettings,
} from '@/features/attendance/stores/attendanceStore'
import { ATTENDANCE_STORAGE_KEY, attendanceFlags, todayKey } from '@/features/attendance/types/attendance'

const FIXED = Date.UTC(2026, 5, 8, 1, 30, 0)

function recordFor(date: string) {
  return attendanceStore.state.records.find((record) => record.date === date)
}

describe('attendanceStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetAttendanceStore()
  })

  it('starts empty with default 09:00/18:00 settings', () => {
    expect(attendanceStore.state.records).toEqual([])
    expect(attendanceStore.state.settings).toEqual({ expectedStart: '09:00', expectedEnd: '18:00' })
  })

  it('clocks in once and is idempotent for the same day', () => {
    const first = clockIn(FIXED)
    expect(first.checkIn).toBeTruthy()
    const firstValue = first.checkIn

    // 第二次上班打卡不覆盖首次签到
    const second = clockIn(FIXED)
    expect(second.checkIn).toBe(firstValue)
    expect(attendanceStore.state.records).toHaveLength(1)
  })

  it('clocks out on today and persists', () => {
    clockIn(FIXED)
    const out = clockOut(FIXED)
    expect(out.checkOut).toBeTruthy()

    resetAttendanceStore()
    expect(recordFor(todayKey(FIXED))?.checkOut).toBeTruthy()
  })

  it('manually sets a record (补卡) and persists', () => {
    setRecord('2026-06-01', { checkIn: '09:05', checkOut: '18:20' })

    resetAttendanceStore()
    expect(recordFor('2026-06-01')).toMatchObject({ checkIn: '09:05', checkOut: '18:20' })
  })

  it('ignores an invalid time when setting a record', () => {
    setRecord('2026-06-02', { checkIn: '9am' })
    expect(recordFor('2026-06-02')?.checkIn).toBeUndefined()
  })

  it('dedupes records by date', () => {
    setRecord('2026-06-03', { checkIn: '09:00' })
    setRecord('2026-06-03', { checkOut: '18:00' })
    expect(attendanceStore.state.records.filter((r) => r.date === '2026-06-03')).toHaveLength(1)
    expect(recordFor('2026-06-03')).toMatchObject({ checkIn: '09:00', checkOut: '18:00' })
  })

  it('flags late and early-leave against the shift settings', () => {
    const settings = attendanceStore.state.settings
    setRecord('2026-06-04', { checkIn: '09:30', checkOut: '17:30' })
    expect(attendanceFlags(recordFor('2026-06-04')!, settings)).toMatchObject({
      late: true,
      earlyLeave: true,
      complete: true,
    })

    setRecord('2026-06-05', { checkIn: '08:50', checkOut: '18:10' })
    expect(attendanceFlags(recordFor('2026-06-05')!, settings)).toMatchObject({ late: false, earlyLeave: false })
  })

  it('updates settings and ignores invalid time', () => {
    updateSettings({ expectedStart: '10:00' })
    expect(attendanceStore.state.settings.expectedStart).toBe('10:00')

    updateSettings({ expectedEnd: 'bad' })
    expect(attendanceStore.state.settings.expectedEnd).toBe('18:00')

    resetAttendanceStore()
    expect(attendanceStore.state.settings.expectedStart).toBe('10:00')
  })

  it('removes a record and persists the removal', () => {
    setRecord('2026-06-06', { checkIn: '09:00' })
    removeRecord('2026-06-06')

    resetAttendanceStore()
    expect(recordFor('2026-06-06')).toBeUndefined()
  })

  it('drops invalid persisted records and falls back to default settings', () => {
    localStorage.setItem(
      ATTENDANCE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        settings: { expectedStart: 'bad', expectedEnd: '18:00' },
        records: [
          { date: '2026-06-07', checkIn: '09:00' },
          { date: 'not-a-date', checkIn: '09:00' },
        ],
      }),
    )

    resetAttendanceStore()
    expect(attendanceStore.state.records).toHaveLength(1)
    expect(attendanceStore.state.records[0].date).toBe('2026-06-07')
    expect(attendanceStore.state.settings).toEqual({ expectedStart: '09:00', expectedEnd: '18:00' })
  })
})

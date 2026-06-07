export const ATTENDANCE_STORAGE_KEY = 'muon.attendance.v1'

/** 考勤班次设置：期望的上/下班时间（HH:mm），用于判定迟到/早退。 */
export interface AttendanceSettings {
  expectedStart: string
  expectedEnd: string
}

/** 一天的打卡记录（按 date 唯一）。checkIn/checkOut 为 HH:mm。 */
export interface AttendanceRecord {
  date: string
  checkIn?: string
  checkOut?: string
}

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  expectedStart: '09:00',
  expectedEnd: '18:00',
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

export function isValidSettings(value: unknown): value is AttendanceSettings {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AttendanceSettings>
  return (
    typeof candidate.expectedStart === 'string' &&
    TIME_RE.test(candidate.expectedStart) &&
    typeof candidate.expectedEnd === 'string' &&
    TIME_RE.test(candidate.expectedEnd)
  )
}

export function isValidRecord(value: unknown): value is AttendanceRecord {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AttendanceRecord>
  return (
    typeof candidate.date === 'string' &&
    DATE_RE.test(candidate.date) &&
    (candidate.checkIn === undefined || (typeof candidate.checkIn === 'string' && TIME_RE.test(candidate.checkIn))) &&
    (candidate.checkOut === undefined || (typeof candidate.checkOut === 'string' && TIME_RE.test(candidate.checkOut)))
  )
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value)
}

export interface AttendanceFlags {
  late: boolean
  earlyLeave: boolean
  complete: boolean
}

/** 依据班次设置判定某条记录的迟到/早退/完整性。 */
export function attendanceFlags(record: AttendanceRecord, settings: AttendanceSettings): AttendanceFlags {
  return {
    late: record.checkIn !== undefined && record.checkIn > settings.expectedStart,
    earlyLeave: record.checkOut !== undefined && record.checkOut < settings.expectedEnd,
    complete: record.checkIn !== undefined && record.checkOut !== undefined,
  }
}

/** 本地今天的日期键 YYYY-MM-DD。 */
export function todayKey(now: number): string {
  const date = new Date(now)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** 本地当前时间 HH:mm。 */
export function timeKey(now: number): string {
  const date = new Date(now)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** 日期键所属月份 YYYY-MM。 */
export function monthOf(dateKey: string): string {
  return dateKey.slice(0, 7)
}

/** 在 YYYY-MM 上偏移 delta 个月。 */
export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  const base = new Date(year, month - 1 + delta, 1)
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`
}

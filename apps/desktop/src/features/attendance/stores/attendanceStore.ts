import type { AttendanceRecord, AttendanceSettings } from '../types/attendance'
import { Store } from '@tanstack/vue-store'
import {
  ATTENDANCE_STORAGE_KEY,
  DEFAULT_ATTENDANCE_SETTINGS,
  isValidRecord,
  isValidSettings,
  isValidTime,
  timeKey,
  todayKey,
} from '../types/attendance'

interface PersistedAttendanceState {
  version: 1
  settings: AttendanceSettings
  records: AttendanceRecord[]
}

interface LoadedAttendanceState {
  settings: AttendanceSettings
  records: AttendanceRecord[]
  normalized: boolean
}

function normalizeRecords(records: unknown[]): { records: AttendanceRecord[]; normalized: boolean } {
  const byDate = new Map<string, AttendanceRecord>()
  let normalized = false
  for (const record of records) {
    if (!isValidRecord(record)) {
      normalized = true
      continue
    }
    if (byDate.has(record.date)) normalized = true
    byDate.set(record.date, record)
  }
  return { records: [...byDate.values()], normalized }
}

function loadState(): LoadedAttendanceState {
  try {
    const raw = localStorage.getItem(ATTENDANCE_STORAGE_KEY)
    if (!raw) return { settings: DEFAULT_ATTENDANCE_SETTINGS, records: [], normalized: false }

    const parsed = JSON.parse(raw) as Partial<PersistedAttendanceState>
    if (parsed.version !== 1) return { settings: DEFAULT_ATTENDANCE_SETTINGS, records: [], normalized: false }

    const settings = isValidSettings(parsed.settings) ? parsed.settings : DEFAULT_ATTENDANCE_SETTINGS
    const settingsNormalized = !isValidSettings(parsed.settings)
    const { records, normalized } = normalizeRecords(Array.isArray(parsed.records) ? parsed.records : [])
    return { settings, records, normalized: normalized || settingsNormalized }
  } catch {
    return { settings: DEFAULT_ATTENDANCE_SETTINGS, records: [], normalized: false }
  }
}

function persist(settings: AttendanceSettings, records: AttendanceRecord[]): void {
  const payload: PersistedAttendanceState = { version: 1, settings, records }
  try {
    localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn('[attendanceStore] Failed to persist attendance:', err)
  }
}

export interface AttendanceState {
  settings: AttendanceSettings
  records: AttendanceRecord[]
  hydrated: boolean
}

function createInitialState(): AttendanceState {
  const { settings, records, normalized } = loadState()
  if (normalized) persist(settings, records)
  return { settings, records, hydrated: true }
}

export const attendanceStore = new Store<AttendanceState>(createInitialState())

export function selectRecords(state: AttendanceState): AttendanceRecord[] {
  return state.records
}

export function selectSettings(state: AttendanceState): AttendanceSettings {
  return state.settings
}

export function hydrate(): void {
  const { settings, records, normalized } = loadState()
  attendanceStore.setState((s) => ({ ...s, settings, records, hydrated: true }))
  if (normalized) persist(settings, records)
}

function commit(settings: AttendanceSettings, records: AttendanceRecord[]): void {
  attendanceStore.setState((s) => ({ ...s, settings, records }))
  persist(attendanceStore.state.settings, attendanceStore.state.records)
}

function upsert(date: string, patch: Partial<Omit<AttendanceRecord, 'date'>>): AttendanceRecord {
  const existing = attendanceStore.state.records.find((record) => record.date === date)
  const next: AttendanceRecord = { date, ...existing, ...patch }
  const records = existing
    ? attendanceStore.state.records.map((record) => (record.date === date ? next : record))
    : [...attendanceStore.state.records, next]
  commit(attendanceStore.state.settings, records)
  return next
}

/** 上班打卡：仅在今日尚未打卡时记录首次签到时间。 */
export function clockIn(now = Date.now()): AttendanceRecord {
  const date = todayKey(now)
  const existing = attendanceStore.state.records.find((record) => record.date === date)
  if (existing?.checkIn) return existing
  return upsert(date, { checkIn: timeKey(now) })
}

/** 下班打卡：记录（更新为）最新的签退时间。 */
export function clockOut(now = Date.now()): AttendanceRecord {
  return upsert(todayKey(now), { checkOut: timeKey(now) })
}

/** 手动设置某日的签到/签退（用于补卡）；非法时间忽略。 */
export function setRecord(date: string, patch: { checkIn?: string; checkOut?: string }): void {
  const clean: Partial<AttendanceRecord> = {}
  if (patch.checkIn !== undefined)
    clean.checkIn = patch.checkIn && isValidTime(patch.checkIn) ? patch.checkIn : undefined
  if (patch.checkOut !== undefined) {
    clean.checkOut = patch.checkOut && isValidTime(patch.checkOut) ? patch.checkOut : undefined
  }
  upsert(date, clean)
}

export function removeRecord(date: string): void {
  const records = attendanceStore.state.records.filter((record) => record.date !== date)
  if (records.length === attendanceStore.state.records.length) return
  commit(attendanceStore.state.settings, records)
}

export function updateSettings(patch: Partial<AttendanceSettings>): void {
  const next: AttendanceSettings = {
    expectedStart:
      patch.expectedStart && isValidTime(patch.expectedStart)
        ? patch.expectedStart
        : attendanceStore.state.settings.expectedStart,
    expectedEnd:
      patch.expectedEnd && isValidTime(patch.expectedEnd)
        ? patch.expectedEnd
        : attendanceStore.state.settings.expectedEnd,
  }
  commit(next, attendanceStore.state.records)
}

export function resetAttendanceStore(): void {
  attendanceStore.setState(() => createInitialState())
}

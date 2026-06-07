// 会议室（线下会议室资源与预定排期），区别于 Matrix 聊天房间（RoomSummary）。
export const ROOMS_STORAGE_KEY = 'muon.rooms.v1'

export interface MeetingRoom {
  id: string
  name: string
  /** 位置（楼层 / 区域） */
  location: string
  /** 容纳人数 */
  capacity: number
  /** 设备标签（投影 / 视频 / 白板…） */
  equipment: string[]
}

export interface RoomBooking {
  id: string
  roomId: string
  title: string
  /** 日期 YYYY-MM-DD */
  date: string
  /** 起始 HH:mm */
  start: string
  /** 结束 HH:mm */
  end: string
  organizer: string
  /** 创建时间戳（毫秒） */
  createdAt: number
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

export function isValidRoom(value: unknown): value is MeetingRoom {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<MeetingRoom>
  return (
    typeof candidate.id === 'string' &&
    !!candidate.id &&
    typeof candidate.name === 'string' &&
    typeof candidate.location === 'string' &&
    typeof candidate.capacity === 'number' &&
    candidate.capacity >= 0 &&
    Array.isArray(candidate.equipment) &&
    candidate.equipment.every((item) => typeof item === 'string')
  )
}

export function isValidBooking(value: unknown): value is RoomBooking {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<RoomBooking>
  return (
    typeof candidate.id === 'string' &&
    !!candidate.id &&
    typeof candidate.roomId === 'string' &&
    !!candidate.roomId &&
    typeof candidate.title === 'string' &&
    typeof candidate.date === 'string' &&
    DATE_RE.test(candidate.date) &&
    typeof candidate.start === 'string' &&
    TIME_RE.test(candidate.start) &&
    typeof candidate.end === 'string' &&
    TIME_RE.test(candidate.end) &&
    candidate.start < candidate.end &&
    typeof candidate.organizer === 'string' &&
    typeof candidate.createdAt === 'number'
  )
}

export function isValidDate(value: string): boolean {
  return DATE_RE.test(value)
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value)
}

/** 两个时段是否重叠（HH:mm 零填充，字典序比较即可）。 */
export function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart
}

/**
 * 候选预定是否与同一会议室、同一天的已有预定冲突。
 * 比较时排除候选自身（按 id），便于改期复用。
 */
export function hasBookingConflict(
  bookings: RoomBooking[],
  candidate: Pick<RoomBooking, 'id' | 'roomId' | 'date' | 'start' | 'end'>,
): boolean {
  return bookings.some(
    (booking) =>
      booking.id !== candidate.id &&
      booking.roomId === candidate.roomId &&
      booking.date === candidate.date &&
      timeRangesOverlap(candidate.start, candidate.end, booking.start, booking.end),
  )
}

export function generateRoomId(now: number): string {
  return `room:${now}:${Math.random().toString(36).slice(2, 10)}`
}

export function generateBookingId(now: number): string {
  return `booking:${now}:${Math.random().toString(36).slice(2, 10)}`
}

export function todayKey(now: number): string {
  const date = new Date(now)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

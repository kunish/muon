import type { MeetingRoom, RoomBooking } from '../types/room'
import { Store } from '@tanstack/vue-store'
import {
  generateBookingId,
  generateRoomId,
  hasBookingConflict,
  isValidBooking,
  isValidRoom,
  isValidTime,
  ROOMS_STORAGE_KEY,
} from '../types/room'

interface PersistedRoomsState {
  version: 1
  rooms: MeetingRoom[]
  bookings: RoomBooking[]
}

interface LoadedRoomsState {
  rooms: MeetingRoom[]
  bookings: RoomBooking[]
  normalized: boolean
}

interface AddRoomInput {
  name: string
  location?: string
  capacity?: number
  equipment?: string[]
  now?: number
}

interface AddBookingInput {
  roomId: string
  title: string
  date: string
  start: string
  end: string
  organizer?: string
  now?: number
}

function dedupeBy<T extends { id: string }>(
  items: unknown[],
  isValid: (v: unknown) => v is T,
): { items: T[]; normalized: boolean } {
  const deduped = new Map<string, T>()
  let normalized = false
  for (const item of items) {
    if (!isValid(item)) {
      normalized = true
      continue
    }
    if (deduped.has(item.id)) normalized = true
    deduped.set(item.id, item)
  }
  return { items: [...deduped.values()], normalized }
}

function loadState(): LoadedRoomsState {
  try {
    const raw = localStorage.getItem(ROOMS_STORAGE_KEY)
    if (!raw) return { rooms: [], bookings: [], normalized: false }

    const parsed = JSON.parse(raw) as Partial<PersistedRoomsState>
    if (parsed.version !== 1 || !Array.isArray(parsed.rooms) || !Array.isArray(parsed.bookings)) {
      return { rooms: [], bookings: [], normalized: false }
    }

    const rooms = dedupeBy(parsed.rooms, isValidRoom)
    const validRoomIds = new Set(rooms.items.map((room) => room.id))
    const bookings = dedupeBy(parsed.bookings, isValidBooking)
    // 丢弃指向已不存在会议室的预定，避免悬挂引用。
    const liveBookings = bookings.items.filter((booking) => validRoomIds.has(booking.roomId))
    const normalized = rooms.normalized || bookings.normalized || liveBookings.length !== bookings.items.length

    return { rooms: rooms.items, bookings: liveBookings, normalized }
  } catch {
    return { rooms: [], bookings: [], normalized: false }
  }
}

function persist(rooms: MeetingRoom[], bookings: RoomBooking[]): void {
  const payload: PersistedRoomsState = { version: 1, rooms, bookings }
  try {
    localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn('[roomStore] Failed to persist rooms:', err)
  }
}

export interface RoomsState {
  rooms: MeetingRoom[]
  bookings: RoomBooking[]
  hydrated: boolean
}

function createInitialState(): RoomsState {
  const { rooms, bookings, normalized } = loadState()
  if (normalized) persist(rooms, bookings)
  return { rooms, bookings, hydrated: true }
}

export const roomStore = new Store<RoomsState>(createInitialState())

export function selectRooms(state: RoomsState): MeetingRoom[] {
  return state.rooms
}

export function selectBookings(state: RoomsState): RoomBooking[] {
  return state.bookings
}

export function hydrate(): void {
  const { rooms, bookings, normalized } = loadState()
  roomStore.setState((s) => ({ ...s, rooms, bookings, hydrated: true }))
  if (normalized) persist(rooms, bookings)
}

function commit(rooms: MeetingRoom[], bookings: RoomBooking[]): void {
  roomStore.setState((s) => ({ ...s, rooms, bookings }))
  persist(roomStore.state.rooms, roomStore.state.bookings)
}

export function addRoom(input: AddRoomInput): MeetingRoom {
  const name = input.name.trim()
  if (!name) throw new Error('Room name is required')

  const now = input.now ?? Date.now()
  const room: MeetingRoom = {
    id: generateRoomId(now),
    name,
    location: input.location?.trim() || '未指定',
    capacity: Number.isFinite(input.capacity) && (input.capacity ?? 0) >= 0 ? Math.floor(input.capacity!) : 0,
    equipment: (input.equipment ?? []).map((item) => item.trim()).filter(Boolean),
  }
  if (!isValidRoom(room)) throw new Error('Invalid room')

  commit([...roomStore.state.rooms, room], roomStore.state.bookings)
  return room
}

export function updateRoom(
  id: string,
  patch: Partial<Pick<MeetingRoom, 'name' | 'location' | 'capacity' | 'equipment'>>,
): void {
  const rooms = roomStore.state.rooms.map((room) =>
    room.id === id
      ? {
          ...room,
          ...(patch.name !== undefined ? { name: patch.name.trim() || room.name } : {}),
          ...(patch.location !== undefined ? { location: patch.location.trim() || room.location } : {}),
          ...(patch.capacity !== undefined && patch.capacity >= 0 ? { capacity: Math.floor(patch.capacity) } : {}),
          ...(patch.equipment !== undefined
            ? { equipment: patch.equipment.map((item) => item.trim()).filter(Boolean) }
            : {}),
        }
      : room,
  )
  commit(rooms, roomStore.state.bookings)
}

/** 删除会议室，并级联删除其全部预定。 */
export function removeRoom(id: string): void {
  const rooms = roomStore.state.rooms.filter((room) => room.id !== id)
  if (rooms.length === roomStore.state.rooms.length) return
  const bookings = roomStore.state.bookings.filter((booking) => booking.roomId !== id)
  commit(rooms, bookings)
}

/** 创建预定；时段非法或与同会议室同日已有预定冲突时抛错。 */
export function addBooking(input: AddBookingInput): RoomBooking {
  const title = input.title.trim()
  if (!title) throw new Error('Booking title is required')
  if (!roomStore.state.rooms.some((room) => room.id === input.roomId)) throw new Error('Unknown room')
  if (!isValidTime(input.start) || !isValidTime(input.end) || input.start >= input.end) {
    throw new Error('Invalid booking time')
  }

  const now = input.now ?? Date.now()
  const booking: RoomBooking = {
    id: generateBookingId(now),
    roomId: input.roomId,
    title,
    date: input.date,
    start: input.start,
    end: input.end,
    organizer: input.organizer?.trim() || '我',
    createdAt: now,
  }
  if (!isValidBooking(booking)) throw new Error('Invalid booking')
  if (hasBookingConflict(roomStore.state.bookings, booking)) throw new Error('Booking conflict')

  commit(roomStore.state.rooms, [...roomStore.state.bookings, booking])
  return booking
}

export function removeBooking(id: string): void {
  const bookings = roomStore.state.bookings.filter((booking) => booking.id !== id)
  if (bookings.length === roomStore.state.bookings.length) return
  commit(roomStore.state.rooms, bookings)
}

export function resetRoomStore(): void {
  roomStore.setState(() => createInitialState())
}

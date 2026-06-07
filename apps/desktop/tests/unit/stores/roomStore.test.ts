import { beforeEach, describe, expect, it } from 'vitest'
import {
  addBooking,
  addRoom,
  removeBooking,
  removeRoom,
  resetRoomStore,
  roomStore,
} from '@/features/rooms/stores/roomStore'
import { hasBookingConflict, ROOMS_STORAGE_KEY } from '@/features/rooms/types/room'

function firstRoom() {
  return roomStore.state.rooms[0]
}

describe('roomStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRoomStore()
  })

  it('starts empty without any seeded mock rooms or bookings', () => {
    expect(roomStore.state.rooms).toEqual([])
    expect(roomStore.state.bookings).toEqual([])
  })

  it('creates a room and persists it with trimmed equipment', () => {
    const room = addRoom({ name: '3F-青松', location: '3 楼东区', capacity: 10, equipment: [' 投影 ', '', '视频'] })

    expect(room.equipment).toEqual(['投影', '视频'])
    expect(room.capacity).toBe(10)

    resetRoomStore()
    expect(firstRoom()).toMatchObject({ name: '3F-青松', location: '3 楼东区', capacity: 10 })
  })

  it('defaults location to 未指定 and floors capacity', () => {
    const room = addRoom({ name: '小会议室', capacity: 4.9 })
    expect(room.location).toBe('未指定')
    expect(room.capacity).toBe(4)
  })

  it('rejects a room with an empty name', () => {
    expect(() => addRoom({ name: '  ' })).toThrow()
    expect(roomStore.state.rooms).toEqual([])
  })

  it('books a slot and persists it', () => {
    const room = addRoom({ name: '会议室' })
    const booking = addBooking({
      roomId: room.id,
      title: '周会',
      date: '2026-06-08',
      start: '09:00',
      end: '10:00',
      organizer: '我',
    })

    expect(booking.organizer).toBe('我')
    resetRoomStore()
    expect(roomStore.state.bookings).toHaveLength(1)
    expect(roomStore.state.bookings[0]).toMatchObject({ title: '周会', start: '09:00', end: '10:00' })
  })

  it('rejects a booking with end not after start', () => {
    const room = addRoom({ name: '会议室' })
    expect(() =>
      addBooking({ roomId: room.id, title: 'x', date: '2026-06-08', start: '10:00', end: '10:00' }),
    ).toThrow()
  })

  it('rejects a booking to an unknown room', () => {
    expect(() => addBooking({ roomId: 'nope', title: 'x', date: '2026-06-08', start: '09:00', end: '10:00' })).toThrow()
  })

  it('rejects an overlapping booking on the same room and date', () => {
    const room = addRoom({ name: '会议室' })
    addBooking({ roomId: room.id, title: 'A', date: '2026-06-08', start: '09:00', end: '10:00' })

    // 09:30–10:30 与 09:00–10:00 重叠
    expect(() => addBooking({ roomId: room.id, title: 'B', date: '2026-06-08', start: '09:30', end: '10:30' })).toThrow(
      'Booking conflict',
    )

    // 邻接但不重叠（10:00–11:00）应当允许
    const ok = addBooking({ roomId: room.id, title: 'C', date: '2026-06-08', start: '10:00', end: '11:00' })
    expect(ok.id).toBeTruthy()
    expect(roomStore.state.bookings).toHaveLength(2)
  })

  it('allows the same slot on a different date', () => {
    const room = addRoom({ name: '会议室' })
    addBooking({ roomId: room.id, title: 'A', date: '2026-06-08', start: '09:00', end: '10:00' })
    const next = addBooking({ roomId: room.id, title: 'B', date: '2026-06-09', start: '09:00', end: '10:00' })
    expect(next.id).toBeTruthy()
  })

  it('cascades booking removal when a room is deleted', () => {
    const room = addRoom({ name: '会议室' })
    addBooking({ roomId: room.id, title: 'A', date: '2026-06-08', start: '09:00', end: '10:00' })
    removeRoom(room.id)

    resetRoomStore()
    expect(roomStore.state.rooms).toEqual([])
    expect(roomStore.state.bookings).toEqual([])
  })

  it('removes a single booking and persists it', () => {
    const room = addRoom({ name: '会议室' })
    const booking = addBooking({ roomId: room.id, title: 'A', date: '2026-06-08', start: '09:00', end: '10:00' })
    removeBooking(booking.id)

    resetRoomStore()
    expect(roomStore.state.bookings).toEqual([])
  })

  it('drops bookings pointing at a missing room when hydrating', () => {
    localStorage.setItem(
      ROOMS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        rooms: [{ id: 'room-1', name: 'R', location: 'x', capacity: 4, equipment: [] }],
        bookings: [
          {
            id: 'b-live',
            roomId: 'room-1',
            title: 'live',
            date: '2026-06-08',
            start: '09:00',
            end: '10:00',
            organizer: '我',
            createdAt: 1,
          },
          {
            id: 'b-orphan',
            roomId: 'gone',
            title: 'orphan',
            date: '2026-06-08',
            start: '09:00',
            end: '10:00',
            organizer: '我',
            createdAt: 2,
          },
        ],
      }),
    )

    resetRoomStore()
    expect(roomStore.state.bookings).toHaveLength(1)
    expect(roomStore.state.bookings[0].id).toBe('b-live')
  })

  it('hasBookingConflict excludes the candidate itself by id', () => {
    const bookings = [
      {
        id: 'b1',
        roomId: 'r1',
        title: 'A',
        date: '2026-06-08',
        start: '09:00',
        end: '10:00',
        organizer: '我',
        createdAt: 1,
      },
    ]
    expect(
      hasBookingConflict(bookings, { id: 'b1', roomId: 'r1', date: '2026-06-08', start: '09:00', end: '10:00' }),
    ).toBe(false)
    expect(
      hasBookingConflict(bookings, { id: 'b2', roomId: 'r1', date: '2026-06-08', start: '09:30', end: '10:30' }),
    ).toBe(true)
  })
})

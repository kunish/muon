import type { MatrixEvent, Room } from 'matrix-js-sdk'
import { MatrixEventEvent, RoomEvent } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bindClientEvents, matrixEvents, unbindClientEvents } from '@/matrix/events'
import { mockClient } from '../../mocks/matrix'

type TimelineListener = (
  event: MatrixEvent,
  room: Room | undefined,
  toStartOfTimeline: boolean,
  removed: boolean,
  data?: { liveEvent?: boolean },
) => void

function createMessageEvent(): MatrixEvent {
  return {
    getType: () => 'm.room.message',
  } as MatrixEvent
}

function createRoom(roomId = '!room:localhost'): Room {
  return {
    roomId,
  } as Room
}

describe('matrix event bridge', () => {
  let timelineListener: TimelineListener | undefined
  let decryptedListener: ((event: MatrixEvent, err?: Error) => void) | undefined

  beforeEach(() => {
    unbindClientEvents()
    vi.clearAllMocks()
    timelineListener = undefined
    decryptedListener = undefined

    vi.mocked(mockClient.on).mockImplementation((eventName: any, listener: any) => {
      if (eventName === RoomEvent.Timeline) timelineListener = listener
      if (eventName === MatrixEventEvent.Decrypted) decryptedListener = listener
      return mockClient as any
    })
  })

  afterEach(() => {
    unbindClientEvents()
    vi.restoreAllMocks()
  })

  it('does not forward backfilled timeline messages as new room messages', () => {
    const emitSpy = vi.spyOn(matrixEvents, 'emit')

    bindClientEvents()
    timelineListener?.(createMessageEvent(), createRoom('!history:localhost'), true, false, {
      liveEvent: false,
    })

    expect(emitSpy).toHaveBeenCalledWith('room.timeline', { roomId: '!history:localhost' })
    expect(emitSpy).not.toHaveBeenCalledWith('room.message', expect.anything())
  })

  it('forwards live timeline messages as room messages', () => {
    const event = createMessageEvent()
    const emitSpy = vi.spyOn(matrixEvents, 'emit')

    bindClientEvents()
    timelineListener?.(event, createRoom('!live:localhost'), false, false, {
      liveEvent: true,
    })

    expect(emitSpy).toHaveBeenCalledWith('room.message', {
      roomId: '!live:localhost',
      event,
    })
  })

  it('forwards decrypted events without treating them as new messages', () => {
    const event = {
      getRoomId: () => '!encrypted:localhost',
      getType: () => 'm.room.message',
    } as MatrixEvent
    const emitSpy = vi.spyOn(matrixEvents, 'emit')

    bindClientEvents()
    decryptedListener?.(event)

    expect(emitSpy).toHaveBeenCalledWith('room.decrypted', {
      roomId: '!encrypted:localhost',
      event,
    })
    expect(emitSpy).toHaveBeenCalledWith('room.timeline', {
      roomId: '!encrypted:localhost',
    })
    expect(emitSpy).not.toHaveBeenCalledWith('room.message', expect.anything())
  })
})

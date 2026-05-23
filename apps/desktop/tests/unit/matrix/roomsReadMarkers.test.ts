import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markRoomAsRead } from '@/matrix/rooms'
import { mockClient } from '../../mocks/matrix'
import { createMatrixEvent, createRecoveryRoom } from '../../mocks/recovery'

describe('markRoomAsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets the fully-read marker to the newest timeline event and receipt to the newest visible event', async () => {
    const visibleEvent = createMatrixEvent({
      eventId: '$message',
      ts: 900,
      body: 'latest channel message',
    })
    const latestStateEvent = createMatrixEvent({
      eventId: '$membership',
      ts: 1000,
      body: 'membership update',
      type: 'm.room.member',
    })
    const room = createRecoveryRoom({
      roomId: '!general:localhost',
      name: 'general',
      liveTimelineEvents: [visibleEvent, latestStateEvent],
    })
    vi.mocked(mockClient.getRoom).mockReturnValue(room)

    await markRoomAsRead(room.roomId)

    expect(mockClient.setRoomReadMarkers).toHaveBeenCalledWith(
      room.roomId,
      '$membership',
      visibleEvent,
    )
  })

  it('does nothing when the room cannot be found', async () => {
    vi.mocked(mockClient.getRoom).mockReturnValue(null)

    await markRoomAsRead('!missing:localhost')

    expect(mockClient.setRoomReadMarkers).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendEventMock = vi.hoisted(() => vi.fn().mockResolvedValue({ event_id: '$call' }))

vi.mock('@/matrix/client', () => ({
  getClient: () => ({ sendEvent: sendEventMock }),
}))

describe('call signaling', () => {
  beforeEach(() => {
    sendEventMock.mockClear()
  })

  it('sends an invite with callId, livekitRoom and mode', async () => {
    const { sendCallInvite } = await import('@/matrix/calls')
    await sendCallInvite('!room:localhost', { callId: 'c1', livekitRoom: 'lk-c1', mode: 'audio' })

    expect(sendEventMock).toHaveBeenCalledWith('!room:localhost', 'im.muon.call.invite', {
      callId: 'c1',
      livekitRoom: 'lk-c1',
      mode: 'audio',
    })
  })

  it('sends an answer with the callId', async () => {
    const { sendCallAnswer } = await import('@/matrix/calls')
    await sendCallAnswer('!room:localhost', 'c1')

    expect(sendEventMock).toHaveBeenCalledWith('!room:localhost', 'im.muon.call.answer', { callId: 'c1' })
  })

  it('sends a hangup with an optional reason', async () => {
    const { sendCallHangup } = await import('@/matrix/calls')
    await sendCallHangup('!room:localhost', 'c1', 'declined')

    expect(sendEventMock).toHaveBeenCalledWith('!room:localhost', 'im.muon.call.hangup', {
      callId: 'c1',
      reason: 'declined',
    })
  })

  it('omits reason when not provided', async () => {
    const { sendCallHangup } = await import('@/matrix/calls')
    await sendCallHangup('!room:localhost', 'c1')

    expect(sendEventMock).toHaveBeenCalledWith('!room:localhost', 'im.muon.call.hangup', { callId: 'c1' })
  })
})

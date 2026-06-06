import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  acceptCall,
  callStore,
  declineCall,
  handleSignal,
  hangup,
  resetCallStore,
  startCall,
  toggleCamera,
  toggleMute,
  toggleRecording,
  toggleScreenShare,
} from '@/features/calls/stores/callStore'

const media = vi.hoisted(() => ({
  connectCallRoom: vi.fn().mockResolvedValue(undefined),
  disconnectCallRoom: vi.fn().mockResolvedValue(undefined),
  setCallMicEnabled: vi.fn().mockResolvedValue(undefined),
  setCallCameraEnabled: vi.fn().mockResolvedValue(undefined),
  setCallScreenShareEnabled: vi.fn().mockResolvedValue(undefined),
  startCallRecording: vi.fn().mockResolvedValue(undefined),
  stopCallRecording: vi.fn().mockResolvedValue(undefined),
}))

const signaling = vi.hoisted(() => ({
  sendCallInvite: vi.fn().mockResolvedValue(undefined),
  sendCallAnswer: vi.fn().mockResolvedValue(undefined),
  sendCallHangup: vi.fn().mockResolvedValue(undefined),
}))

const recordingApi = vi.hoisted(() => ({
  isRecordingBackendConfigured: vi.fn(() => false),
  startCloudRecording: vi.fn().mockResolvedValue({ egressId: 'eg-1' }),
  stopCloudRecording: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/features/calls/lib/callMedia', () => media)
vi.mock('@/features/calls/lib/recordingApi', () => recordingApi)

vi.mock('@matrix/client', () => ({
  getClient: () => ({
    getUserId: () => '@me:localhost',
    getRoom: () => ({ getMember: () => ({ name: 'Alice' }) }),
  }),
}))

vi.mock('@matrix/index', () => ({
  matrixEvents: { on: vi.fn(), off: vi.fn() },
  sendCallInvite: signaling.sendCallInvite,
  sendCallAnswer: signaling.sendCallAnswer,
  sendCallHangup: signaling.sendCallHangup,
  CALL_INVITE_EVENT: 'im.muon.call.invite',
  CALL_ANSWER_EVENT: 'im.muon.call.answer',
  CALL_HANGUP_EVENT: 'im.muon.call.hangup',
}))

function invite(content: Record<string, unknown>, senderId = '@alice:localhost') {
  return { roomId: '!dm:localhost', senderId, type: 'im.muon.call.invite', content }
}

describe('callStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetCallStore()
    vi.clearAllMocks()
  })

  it('startCall goes outgoing, joins the room and sends an invite', async () => {
    await startCall('!dm:localhost', '@alice:localhost', 'Alice')

    expect(callStore.state.status).toBe('outgoing')
    expect(callStore.state.callId).toBeTruthy()
    expect(callStore.state.mode).toBe('audio')
    expect(media.connectCallRoom).toHaveBeenCalledWith(callStore.state.callId, 'audio')
    expect(signaling.sendCallInvite).toHaveBeenCalledWith('!dm:localhost', {
      callId: callStore.state.callId,
      livekitRoom: callStore.state.callId,
      mode: 'audio',
    })
  })

  it('startCall in video mode publishes the camera and advertises the mode', async () => {
    await startCall('!dm:localhost', '@alice:localhost', 'Alice', 'video')

    expect(callStore.state.mode).toBe('video')
    expect(media.connectCallRoom).toHaveBeenCalledWith(callStore.state.callId, 'video')
    expect(signaling.sendCallInvite).toHaveBeenCalledWith('!dm:localhost', {
      callId: callStore.state.callId,
      livekitRoom: callStore.state.callId,
      mode: 'video',
    })
  })

  it('connects when the callee answers the outgoing call', async () => {
    await startCall('!dm:localhost', '@alice:localhost', 'Alice')
    handleSignal({
      roomId: '!dm:localhost',
      senderId: '@alice:localhost',
      type: 'im.muon.call.answer',
      content: { callId: callStore.state.callId },
    })

    expect(callStore.state.status).toBe('connected')
    expect(callStore.state.startedAt).toBeTruthy()
  })

  it('an incoming invite moves to incoming with the resolved peer name', async () => {
    handleSignal(invite({ callId: 'c1', livekitRoom: 'c1', mode: 'audio' }))

    expect(callStore.state.status).toBe('incoming')
    expect(callStore.state.callId).toBe('c1')
    expect(callStore.state.peerName).toBe('Alice')
  })

  it('acceptCall joins the room and answers', async () => {
    handleSignal(invite({ callId: 'c1', livekitRoom: 'c1', mode: 'audio' }))
    await acceptCall()

    expect(media.connectCallRoom).toHaveBeenCalledWith('c1', 'audio')
    expect(signaling.sendCallAnswer).toHaveBeenCalledWith('!dm:localhost', 'c1')
    expect(callStore.state.status).toBe('connected')
  })

  it('acceptCall joins a video invite with the camera enabled', async () => {
    handleSignal(invite({ callId: 'c1', livekitRoom: 'c1', mode: 'video' }))
    await acceptCall()

    expect(callStore.state.mode).toBe('video')
    expect(media.connectCallRoom).toHaveBeenCalledWith('c1', 'video')
  })

  it('declineCall hangs up and returns to idle', async () => {
    handleSignal(invite({ callId: 'c1', livekitRoom: 'c1', mode: 'audio' }))
    declineCall()

    expect(signaling.sendCallHangup).toHaveBeenCalledWith('!dm:localhost', 'c1', 'declined')
    expect(callStore.state.status).toBe('idle')
  })

  it('auto-declines a second invite while busy', async () => {
    handleSignal(invite({ callId: 'c1', livekitRoom: 'c1', mode: 'audio' }))
    handleSignal(invite({ callId: 'c2', livekitRoom: 'c2', mode: 'audio' }, '@bob:localhost'))

    expect(signaling.sendCallHangup).toHaveBeenCalledWith('!dm:localhost', 'c2', 'busy')
    expect(callStore.state.callId).toBe('c1') // still on the first call
  })

  it('hangup tears down media and resets', async () => {
    await startCall('!dm:localhost', '@alice:localhost', 'Alice')
    await hangup()

    expect(signaling.sendCallHangup).toHaveBeenCalled()
    expect(media.disconnectCallRoom).toHaveBeenCalled()
    expect(callStore.state.status).toBe('idle')
  })

  it('remote hangup ends the active call', async () => {
    await startCall('!dm:localhost', '@alice:localhost', 'Alice')
    handleSignal({
      roomId: '!dm:localhost',
      senderId: '@alice:localhost',
      type: 'im.muon.call.hangup',
      content: { callId: callStore.state.callId },
    })
    await Promise.resolve()

    expect(media.disconnectCallRoom).toHaveBeenCalled()
    expect(callStore.state.status).toBe('idle')
  })

  it('toggleMute flips state and updates the mic', async () => {
    await startCall('!dm:localhost', '@alice:localhost', 'Alice')
    await toggleMute()

    expect(callStore.state.isMuted).toBe(true)
    expect(media.setCallMicEnabled).toHaveBeenCalledWith(false)
  })

  it('toggleCamera flips state and updates the camera', async () => {
    await startCall('!dm:localhost', '@alice:localhost', 'Alice', 'video')
    await toggleCamera()

    expect(callStore.state.isCameraOff).toBe(true)
    expect(media.setCallCameraEnabled).toHaveBeenCalledWith(false)
  })

  it('toggleScreenShare publishes the screen and tracks the state', async () => {
    await startCall('!dm:localhost', '@alice:localhost', 'Alice', 'video')
    await toggleScreenShare()

    expect(media.setCallScreenShareEnabled).toHaveBeenCalledWith(true)
    expect(callStore.state.isScreenSharing).toBe(true)
  })

  it('toggleRecording starts and stops the local recorder', async () => {
    await startCall('!dm:localhost', '@alice:localhost', 'Alice', 'video')

    await toggleRecording()
    expect(callStore.state.isRecording).toBe(true)
    expect(media.startCallRecording).toHaveBeenCalled()

    await toggleRecording()
    expect(callStore.state.isRecording).toBe(false)
    expect(media.stopCallRecording).toHaveBeenCalled()
  })

  it('toggleRecording uses the local recorder when no backend is configured', async () => {
    recordingApi.isRecordingBackendConfigured.mockReturnValue(false)
    await startCall('!dm:localhost', '@alice:localhost', 'Alice', 'video')

    await toggleRecording()
    expect(callStore.state.isRecording).toBe(true)
    expect(media.startCallRecording).toHaveBeenCalled()
    expect(recordingApi.startCloudRecording).not.toHaveBeenCalled()
  })

  it('toggleRecording uses cloud egress when the backend is configured', async () => {
    recordingApi.isRecordingBackendConfigured.mockReturnValue(true)
    await startCall('!dm:localhost', '@alice:localhost', 'Alice', 'video')

    await toggleRecording()
    expect(callStore.state.isRecording).toBe(true)
    expect(recordingApi.startCloudRecording).toHaveBeenCalledWith(callStore.state.callId)
    expect(media.startCallRecording).not.toHaveBeenCalled()

    await toggleRecording()
    expect(callStore.state.isRecording).toBe(false)
    expect(recordingApi.stopCloudRecording).toHaveBeenCalledWith('eg-1')
  })

  it('keeps screen sharing off when the picker is cancelled', async () => {
    media.setCallScreenShareEnabled.mockRejectedValueOnce(new Error('cancelled'))
    await startCall('!dm:localhost', '@alice:localhost', 'Alice', 'video')
    await toggleScreenShare()

    expect(callStore.state.isScreenSharing).toBe(false)
  })

  it('records a completed call in local history when it ends', async () => {
    localStorage.clear()
    await startCall('!dm:localhost', '@alice:localhost', 'Alice', 'video')
    handleSignal({
      roomId: '!dm:localhost',
      senderId: '@alice:localhost',
      type: 'im.muon.call.answer',
      content: { callId: callStore.state.callId },
    })
    await hangup()

    expect(callStore.state.callHistory[0]).toMatchObject({
      peerId: '@alice:localhost',
      mode: 'video',
      direction: 'outgoing',
      outcome: 'completed',
    })
  })

  it('records a declined incoming call as missed', async () => {
    localStorage.clear()
    handleSignal(invite({ callId: 'c1', livekitRoom: 'c1', mode: 'audio' }))
    declineCall()

    expect(callStore.state.callHistory[0]).toMatchObject({ id: 'c1', direction: 'incoming', outcome: 'missed' })
  })

  it('ignores its own signals', async () => {
    handleSignal(invite({ callId: 'c1', livekitRoom: 'c1', mode: 'audio' }, '@me:localhost'))

    expect(callStore.state.status).toBe('idle')
  })
})

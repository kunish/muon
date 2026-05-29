import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

async function importStore() {
  return (await import('@/features/calls/stores/callStore')).useCallStore()
}

function invite(content: Record<string, unknown>, senderId = '@alice:localhost') {
  return { roomId: '!dm:localhost', senderId, type: 'im.muon.call.invite', content }
}

describe('callStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('startCall goes outgoing, joins the room and sends an invite', async () => {
    const store = await importStore()
    await store.startCall('!dm:localhost', '@alice:localhost', 'Alice')

    expect(store.status).toBe('outgoing')
    expect(store.callId).toBeTruthy()
    expect(store.mode).toBe('audio')
    expect(media.connectCallRoom).toHaveBeenCalledWith(store.callId, 'audio')
    expect(signaling.sendCallInvite).toHaveBeenCalledWith('!dm:localhost', {
      callId: store.callId,
      livekitRoom: store.callId,
      mode: 'audio',
    })
  })

  it('startCall in video mode publishes the camera and advertises the mode', async () => {
    const store = await importStore()
    await store.startCall('!dm:localhost', '@alice:localhost', 'Alice', 'video')

    expect(store.mode).toBe('video')
    expect(media.connectCallRoom).toHaveBeenCalledWith(store.callId, 'video')
    expect(signaling.sendCallInvite).toHaveBeenCalledWith('!dm:localhost', {
      callId: store.callId,
      livekitRoom: store.callId,
      mode: 'video',
    })
  })

  it('connects when the callee answers the outgoing call', async () => {
    const store = await importStore()
    await store.startCall('!dm:localhost', '@alice:localhost', 'Alice')
    store.handleSignal({
      roomId: '!dm:localhost',
      senderId: '@alice:localhost',
      type: 'im.muon.call.answer',
      content: { callId: store.callId },
    })

    expect(store.status).toBe('connected')
    expect(store.startedAt).toBeTruthy()
  })

  it('an incoming invite moves to incoming with the resolved peer name', async () => {
    const store = await importStore()
    store.handleSignal(invite({ callId: 'c1', livekitRoom: 'c1', mode: 'audio' }))

    expect(store.status).toBe('incoming')
    expect(store.callId).toBe('c1')
    expect(store.peerName).toBe('Alice')
  })

  it('acceptCall joins the room and answers', async () => {
    const store = await importStore()
    store.handleSignal(invite({ callId: 'c1', livekitRoom: 'c1', mode: 'audio' }))
    await store.acceptCall()

    expect(media.connectCallRoom).toHaveBeenCalledWith('c1', 'audio')
    expect(signaling.sendCallAnswer).toHaveBeenCalledWith('!dm:localhost', 'c1')
    expect(store.status).toBe('connected')
  })

  it('acceptCall joins a video invite with the camera enabled', async () => {
    const store = await importStore()
    store.handleSignal(invite({ callId: 'c1', livekitRoom: 'c1', mode: 'video' }))
    await store.acceptCall()

    expect(store.mode).toBe('video')
    expect(media.connectCallRoom).toHaveBeenCalledWith('c1', 'video')
  })

  it('declineCall hangs up and returns to idle', async () => {
    const store = await importStore()
    store.handleSignal(invite({ callId: 'c1', livekitRoom: 'c1', mode: 'audio' }))
    store.declineCall()

    expect(signaling.sendCallHangup).toHaveBeenCalledWith('!dm:localhost', 'c1', 'declined')
    expect(store.status).toBe('idle')
  })

  it('auto-declines a second invite while busy', async () => {
    const store = await importStore()
    store.handleSignal(invite({ callId: 'c1', livekitRoom: 'c1', mode: 'audio' }))
    store.handleSignal(invite({ callId: 'c2', livekitRoom: 'c2', mode: 'audio' }, '@bob:localhost'))

    expect(signaling.sendCallHangup).toHaveBeenCalledWith('!dm:localhost', 'c2', 'busy')
    expect(store.callId).toBe('c1') // still on the first call
  })

  it('hangup tears down media and resets', async () => {
    const store = await importStore()
    await store.startCall('!dm:localhost', '@alice:localhost', 'Alice')
    await store.hangup()

    expect(signaling.sendCallHangup).toHaveBeenCalled()
    expect(media.disconnectCallRoom).toHaveBeenCalled()
    expect(store.status).toBe('idle')
  })

  it('remote hangup ends the active call', async () => {
    const store = await importStore()
    await store.startCall('!dm:localhost', '@alice:localhost', 'Alice')
    store.handleSignal({
      roomId: '!dm:localhost',
      senderId: '@alice:localhost',
      type: 'im.muon.call.hangup',
      content: { callId: store.callId },
    })
    await Promise.resolve()

    expect(media.disconnectCallRoom).toHaveBeenCalled()
    expect(store.status).toBe('idle')
  })

  it('toggleMute flips state and updates the mic', async () => {
    const store = await importStore()
    await store.startCall('!dm:localhost', '@alice:localhost', 'Alice')
    await store.toggleMute()

    expect(store.isMuted).toBe(true)
    expect(media.setCallMicEnabled).toHaveBeenCalledWith(false)
  })

  it('toggleCamera flips state and updates the camera', async () => {
    const store = await importStore()
    await store.startCall('!dm:localhost', '@alice:localhost', 'Alice', 'video')
    await store.toggleCamera()

    expect(store.isCameraOff).toBe(true)
    expect(media.setCallCameraEnabled).toHaveBeenCalledWith(false)
  })

  it('toggleScreenShare publishes the screen and tracks the state', async () => {
    const store = await importStore()
    await store.startCall('!dm:localhost', '@alice:localhost', 'Alice', 'video')
    await store.toggleScreenShare()

    expect(media.setCallScreenShareEnabled).toHaveBeenCalledWith(true)
    expect(store.isScreenSharing).toBe(true)
  })

  it('toggleRecording starts and stops the local recorder', async () => {
    const store = await importStore()
    await store.startCall('!dm:localhost', '@alice:localhost', 'Alice', 'video')

    await store.toggleRecording()
    expect(store.isRecording).toBe(true)
    expect(media.startCallRecording).toHaveBeenCalled()

    await store.toggleRecording()
    expect(store.isRecording).toBe(false)
    expect(media.stopCallRecording).toHaveBeenCalled()
  })

  it('toggleRecording uses the local recorder when no backend is configured', async () => {
    recordingApi.isRecordingBackendConfigured.mockReturnValue(false)
    const store = await importStore()
    await store.startCall('!dm:localhost', '@alice:localhost', 'Alice', 'video')

    await store.toggleRecording()
    expect(store.isRecording).toBe(true)
    expect(media.startCallRecording).toHaveBeenCalled()
    expect(recordingApi.startCloudRecording).not.toHaveBeenCalled()
  })

  it('toggleRecording uses cloud egress when the backend is configured', async () => {
    recordingApi.isRecordingBackendConfigured.mockReturnValue(true)
    const store = await importStore()
    await store.startCall('!dm:localhost', '@alice:localhost', 'Alice', 'video')

    await store.toggleRecording()
    expect(store.isRecording).toBe(true)
    expect(recordingApi.startCloudRecording).toHaveBeenCalledWith(store.callId)
    expect(media.startCallRecording).not.toHaveBeenCalled()

    await store.toggleRecording()
    expect(store.isRecording).toBe(false)
    expect(recordingApi.stopCloudRecording).toHaveBeenCalledWith('eg-1')
  })

  it('keeps screen sharing off when the picker is cancelled', async () => {
    const store = await importStore()
    media.setCallScreenShareEnabled.mockRejectedValueOnce(new Error('cancelled'))
    await store.startCall('!dm:localhost', '@alice:localhost', 'Alice', 'video')
    await store.toggleScreenShare()

    expect(store.isScreenSharing).toBe(false)
  })

  it('records a completed call in local history when it ends', async () => {
    localStorage.clear()
    const store = await importStore()
    await store.startCall('!dm:localhost', '@alice:localhost', 'Alice', 'video')
    store.handleSignal({
      roomId: '!dm:localhost',
      senderId: '@alice:localhost',
      type: 'im.muon.call.answer',
      content: { callId: store.callId },
    })
    await store.hangup()

    expect(store.callHistory[0]).toMatchObject({
      peerId: '@alice:localhost',
      mode: 'video',
      direction: 'outgoing',
      outcome: 'completed',
    })
  })

  it('records a declined incoming call as missed', async () => {
    localStorage.clear()
    const store = await importStore()
    store.handleSignal(invite({ callId: 'c1', livekitRoom: 'c1', mode: 'audio' }))
    store.declineCall()

    expect(store.callHistory[0]).toMatchObject({ id: 'c1', direction: 'incoming', outcome: 'missed' })
  })

  it('ignores its own signals', async () => {
    const store = await importStore()
    store.handleSignal(invite({ callId: 'c1', livekitRoom: 'c1', mode: 'audio' }, '@me:localhost'))

    expect(store.status).toBe('idle')
  })
})

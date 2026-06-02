import type { CallMode } from '@matrix/index'
import { getClient } from '@matrix/client'
import {
  CALL_ANSWER_EVENT,
  CALL_HANGUP_EVENT,
  CALL_INVITE_EVENT,
  matrixEvents,
  sendCallAnswer,
  sendCallHangup,
  sendCallInvite,
} from '@matrix/index'
import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  connectCallRoom,
  disconnectCallRoom,
  setCallCameraEnabled,
  setCallMicEnabled,
  setCallScreenShareEnabled,
  startCallRecording,
  stopCallRecording,
} from '../lib/callMedia'
import { isRecordingBackendConfigured, startCloudRecording, stopCloudRecording } from '../lib/recordingApi'

export type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'connected' | 'ended'
export type CallDirection = 'outgoing' | 'incoming'
export type CallOutcome = 'completed' | 'missed'

export interface CallHistoryEntry {
  id: string
  peerId: string
  peerName: string
  mode: CallMode
  direction: CallDirection
  outcome: CallOutcome
  durationSec: number
  endedAt: number
  /** 云录制回放 URL（仅当本次通话进行了云录制时存在） */
  recordingUrl?: string
}

const CALL_HISTORY_STORAGE_KEY = 'muon_call_history'
const CALL_HISTORY_LIMIT = 50

interface CallSignal {
  roomId: string
  senderId: string
  type: string
  content: Record<string, unknown>
}

function generateCallId(): string {
  return `call:${Math.random().toString(36).slice(2, 12)}`
}

export const useCallStore = defineStore('call', () => {
  const status = ref<CallStatus>('idle')
  const callId = ref<string | null>(null)
  const roomId = ref<string | null>(null)
  const livekitRoom = ref<string | null>(null)
  const peerId = ref<string | null>(null)
  const peerName = ref<string | null>(null)
  const mode = ref<CallMode>('audio')
  const isMuted = ref(false)
  const isCameraOff = ref(false)
  const isScreenSharing = ref(false)
  const isRecording = ref(false)
  const recordingEgressId = ref<string | null>(null)
  const recordingUrl = ref<string | null>(null)
  const direction = ref<CallDirection>('outgoing')
  const startedAt = ref<number | null>(null)

  const callHistory = useStorage<CallHistoryEntry[]>(CALL_HISTORY_STORAGE_KEY, [])

  const isActive = computed(() => status.value !== 'idle' && status.value !== 'ended')

  /** Append the call that is being torn down to the local history log. */
  function recordCall(outcome: CallOutcome, durationSec: number) {
    if (!callId.value || !peerId.value) return
    const entry: CallHistoryEntry = {
      id: callId.value,
      peerId: peerId.value,
      peerName: peerName.value || peerId.value,
      mode: mode.value,
      direction: direction.value,
      outcome,
      durationSec,
      endedAt: Date.now(),
      ...(recordingUrl.value ? { recordingUrl: recordingUrl.value } : {}),
    }
    callHistory.value = [entry, ...callHistory.value].slice(0, CALL_HISTORY_LIMIT)
  }

  function reset() {
    status.value = 'idle'
    callId.value = null
    roomId.value = null
    livekitRoom.value = null
    peerId.value = null
    peerName.value = null
    isMuted.value = false
    isCameraOff.value = false
    isScreenSharing.value = false
    isRecording.value = false
    recordingEgressId.value = null
    recordingUrl.value = null
    startedAt.value = null
  }

  function resolvePeerName(targetRoomId: string, userId: string): string {
    const member = getClient().getRoom(targetRoomId)?.getMember(userId)
    return member?.name || userId.split(':')[0]?.replace(/^@/, '') || userId
  }

  async function endCall() {
    const wasConnected = status.value === 'connected' && startedAt.value != null
    const durationSec = wasConnected ? Math.floor((Date.now() - startedAt.value!) / 1000) : 0
    recordCall(wasConnected ? 'completed' : 'missed', durationSec)
    try {
      await disconnectCallRoom()
    } catch {
      /* ignore media teardown errors */
    }
    reset()
  }

  /** 主叫发起 1:1 通话 */
  async function startCall(
    targetRoomId: string,
    peerUserId: string,
    peerDisplayName: string,
    callMode: CallMode = 'audio',
  ) {
    if (status.value !== 'idle') return
    const id = generateCallId()
    callId.value = id
    livekitRoom.value = id
    roomId.value = targetRoomId
    peerId.value = peerUserId
    peerName.value = peerDisplayName
    mode.value = callMode
    direction.value = 'outgoing'
    isMuted.value = false
    isCameraOff.value = false
    status.value = 'outgoing'

    try {
      await connectCallRoom(id, callMode)
      await sendCallInvite(targetRoomId, { callId: id, livekitRoom: id, mode: callMode })
    } catch {
      await endCall()
    }
  }

  /** 被叫接听 */
  async function acceptCall() {
    if (status.value !== 'incoming' || !callId.value || !roomId.value || !livekitRoom.value) return
    status.value = 'connecting'
    try {
      await connectCallRoom(livekitRoom.value, mode.value)
      await sendCallAnswer(roomId.value, callId.value)
      status.value = 'connected'
      startedAt.value = Date.now()
    } catch {
      await endCall()
    }
  }

  /** 被叫拒绝 */
  function declineCall() {
    if (status.value !== 'incoming') return
    if (roomId.value && callId.value) void sendCallHangup(roomId.value, callId.value, 'declined')
    recordCall('missed', 0)
    reset()
  }

  /** 主动挂断/取消 */
  async function hangup() {
    if (roomId.value && callId.value) void sendCallHangup(roomId.value, callId.value)
    await endCall()
  }

  async function toggleMute() {
    isMuted.value = !isMuted.value
    try {
      await setCallMicEnabled(!isMuted.value)
    } catch {
      /* ignore mic toggle errors */
    }
  }

  async function toggleCamera() {
    isCameraOff.value = !isCameraOff.value
    try {
      await setCallCameraEnabled(!isCameraOff.value)
    } catch {
      /* ignore camera toggle errors */
    }
  }

  async function toggleScreenShare() {
    const next = !isScreenSharing.value
    try {
      await setCallScreenShareEnabled(next)
      isScreenSharing.value = next
    } catch {
      /* user cancelled the picker or sharing is unavailable */
    }
  }

  async function toggleRecording() {
    if (isRecording.value) {
      isRecording.value = false
      // 云录制:停止服务端 egress;否则停止本地录制
      if (recordingEgressId.value) {
        const egressId = recordingEgressId.value
        recordingEgressId.value = null
        try {
          await stopCloudRecording(egressId)
        } catch {
          /* ignore stop errors */
        }
        return
      }
      await stopCallRecording()
      return
    }

    // 配置了应用自带录制后端时,优先用云录制(LiveKit Egress → 对象存储)
    if (isRecordingBackendConfigured() && callId.value) {
      try {
        const { egressId, fileUrl } = await startCloudRecording(callId.value)
        recordingEgressId.value = egressId
        recordingUrl.value = fileUrl ?? null
        isRecording.value = true
        return
      } catch {
        /* 云录制失败则退回本地录制 */
      }
    }

    await startCallRecording()
    isRecording.value = true
  }

  function handleSignal(signal: CallSignal) {
    if (signal.senderId === getClient().getUserId()) return
    const content = signal.content
    const signalCallId = typeof content.callId === 'string' ? content.callId : null
    if (!signalCallId) return

    if (signal.type === CALL_INVITE_EVENT) {
      // 占线：自动拒绝新来电
      if (status.value !== 'idle') {
        void sendCallHangup(signal.roomId, signalCallId, 'busy')
        return
      }
      callId.value = signalCallId
      livekitRoom.value = typeof content.livekitRoom === 'string' ? content.livekitRoom : signalCallId
      roomId.value = signal.roomId
      peerId.value = signal.senderId
      peerName.value = resolvePeerName(signal.roomId, signal.senderId)
      mode.value = content.mode === 'video' ? 'video' : 'audio'
      direction.value = 'incoming'
      isMuted.value = false
      status.value = 'incoming'
      return
    }

    if (signalCallId !== callId.value) return

    if (signal.type === CALL_ANSWER_EVENT) {
      if (status.value === 'outgoing') {
        status.value = 'connected'
        startedAt.value = Date.now()
      }
      return
    }

    if (signal.type === CALL_HANGUP_EVENT) {
      void endCall()
    }
  }

  matrixEvents.on('call.signal', handleSignal)

  return {
    status,
    callId,
    roomId,
    peerId,
    peerName,
    mode,
    isMuted,
    isCameraOff,
    isScreenSharing,
    isRecording,
    direction,
    startedAt,
    callHistory,
    isActive,
    startCall,
    acceptCall,
    declineCall,
    hangup,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    toggleRecording,
    handleSignal,
  }
})

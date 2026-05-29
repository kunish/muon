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
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { connectCallRoom, disconnectCallRoom, setCallMicEnabled } from '../lib/callMedia'

export type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'connected' | 'ended'

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
  const startedAt = ref<number | null>(null)

  const isActive = computed(() => status.value !== 'idle' && status.value !== 'ended')

  function reset() {
    status.value = 'idle'
    callId.value = null
    roomId.value = null
    livekitRoom.value = null
    peerId.value = null
    peerName.value = null
    isMuted.value = false
    startedAt.value = null
  }

  function resolvePeerName(targetRoomId: string, userId: string): string {
    const member = getClient().getRoom(targetRoomId)?.getMember(userId)
    return member?.name || userId.split(':')[0]?.replace(/^@/, '') || userId
  }

  async function endCall() {
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
    isMuted.value = false
    status.value = 'outgoing'

    try {
      await connectCallRoom(id)
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
      await connectCallRoom(livekitRoom.value)
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
    startedAt,
    isActive,
    startCall,
    acceptCall,
    declineCall,
    hangup,
    toggleMute,
    handleSignal,
  }
})

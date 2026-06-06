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
import { Store } from '@tanstack/vue-store'
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

export interface CallState {
  status: CallStatus
  callId: string | null
  roomId: string | null
  livekitRoom: string | null
  peerId: string | null
  peerName: string | null
  mode: CallMode
  isMuted: boolean
  isCameraOff: boolean
  isScreenSharing: boolean
  isRecording: boolean
  recordingEgressId: string | null
  recordingUrl: string | null
  direction: CallDirection
  startedAt: number | null
  callHistory: CallHistoryEntry[]
}

function loadCallHistory(): CallHistoryEntry[] {
  try {
    const raw = localStorage.getItem(CALL_HISTORY_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CallHistoryEntry[]) : []
  } catch {
    return []
  }
}

function persistCallHistory(history: CallHistoryEntry[]): void {
  try {
    localStorage.setItem(CALL_HISTORY_STORAGE_KEY, JSON.stringify(history))
  } catch {
    /* persistence is best-effort */
  }
}

function createInitialState(): CallState {
  return {
    status: 'idle',
    callId: null,
    roomId: null,
    livekitRoom: null,
    peerId: null,
    peerName: null,
    mode: 'audio',
    isMuted: false,
    isCameraOff: false,
    isScreenSharing: false,
    isRecording: false,
    recordingEgressId: null,
    recordingUrl: null,
    direction: 'outgoing',
    startedAt: null,
    callHistory: loadCallHistory(),
  }
}

export const callStore = new Store<CallState>(createInitialState())

const set = (updater: (s: CallState) => CallState) => callStore.setState(updater)

function generateCallId(): string {
  return `call:${Math.random().toString(36).slice(2, 12)}`
}

// ── Pure selectors for reactive component reads ──
export function selectIsActive(s: CallState): boolean {
  return s.status !== 'idle' && s.status !== 'ended'
}

/** Append the call that is being torn down to the local history log. */
export function recordCall(outcome: CallOutcome, durationSec: number) {
  const s = callStore.state
  if (!s.callId || !s.peerId) return
  const entry: CallHistoryEntry = {
    id: s.callId,
    peerId: s.peerId,
    peerName: s.peerName || s.peerId,
    mode: s.mode,
    direction: s.direction,
    outcome,
    durationSec,
    endedAt: Date.now(),
    ...(s.recordingUrl ? { recordingUrl: s.recordingUrl } : {}),
  }
  const callHistory = [entry, ...s.callHistory].slice(0, CALL_HISTORY_LIMIT)
  set((prev) => ({ ...prev, callHistory }))
  persistCallHistory(callHistory)
}

export function reset() {
  set((s) => ({
    ...s,
    status: 'idle',
    callId: null,
    roomId: null,
    livekitRoom: null,
    peerId: null,
    peerName: null,
    isMuted: false,
    isCameraOff: false,
    isScreenSharing: false,
    isRecording: false,
    recordingEgressId: null,
    recordingUrl: null,
    startedAt: null,
  }))
}

export function resolvePeerName(targetRoomId: string, userId: string): string {
  const member = getClient().getRoom(targetRoomId)?.getMember(userId)
  return member?.name || userId.split(':')[0]?.replace(/^@/, '') || userId
}

export async function endCall() {
  const s = callStore.state
  const wasConnected = s.status === 'connected' && s.startedAt != null
  const durationSec = wasConnected ? Math.floor((Date.now() - s.startedAt!) / 1000) : 0
  recordCall(wasConnected ? 'completed' : 'missed', durationSec)
  try {
    await disconnectCallRoom()
  } catch {
    /* ignore media teardown errors */
  }
  reset()
}

/** 主叫发起 1:1 通话 */
export async function startCall(
  targetRoomId: string,
  peerUserId: string,
  peerDisplayName: string,
  callMode: CallMode = 'audio',
) {
  if (callStore.state.status !== 'idle') return
  const id = generateCallId()
  set((s) => ({
    ...s,
    callId: id,
    livekitRoom: id,
    roomId: targetRoomId,
    peerId: peerUserId,
    peerName: peerDisplayName,
    mode: callMode,
    direction: 'outgoing',
    isMuted: false,
    isCameraOff: false,
    status: 'outgoing',
  }))

  try {
    await connectCallRoom(id, callMode)
    await sendCallInvite(targetRoomId, { callId: id, livekitRoom: id, mode: callMode })
  } catch {
    await endCall()
  }
}

/** 被叫接听 */
export async function acceptCall() {
  const s = callStore.state
  if (s.status !== 'incoming' || !s.callId || !s.roomId || !s.livekitRoom) return
  set((prev) => ({ ...prev, status: 'connecting' }))
  try {
    await connectCallRoom(s.livekitRoom, s.mode)
    await sendCallAnswer(s.roomId, s.callId)
    set((prev) => ({ ...prev, status: 'connected', startedAt: Date.now() }))
  } catch {
    await endCall()
  }
}

/** 被叫拒绝 */
export function declineCall() {
  const s = callStore.state
  if (s.status !== 'incoming') return
  if (s.roomId && s.callId) void sendCallHangup(s.roomId, s.callId, 'declined')
  recordCall('missed', 0)
  reset()
}

/** 主动挂断/取消 */
export async function hangup() {
  const s = callStore.state
  if (s.roomId && s.callId) void sendCallHangup(s.roomId, s.callId)
  await endCall()
}

export async function toggleMute() {
  set((s) => ({ ...s, isMuted: !s.isMuted }))
  try {
    await setCallMicEnabled(!callStore.state.isMuted)
  } catch {
    /* ignore mic toggle errors */
  }
}

export async function toggleCamera() {
  set((s) => ({ ...s, isCameraOff: !s.isCameraOff }))
  try {
    await setCallCameraEnabled(!callStore.state.isCameraOff)
  } catch {
    /* ignore camera toggle errors */
  }
}

export async function toggleScreenShare() {
  const next = !callStore.state.isScreenSharing
  try {
    await setCallScreenShareEnabled(next)
    set((s) => ({ ...s, isScreenSharing: next }))
  } catch {
    /* user cancelled the picker or sharing is unavailable */
  }
}

export async function toggleRecording() {
  const s = callStore.state
  if (s.isRecording) {
    set((prev) => ({ ...prev, isRecording: false }))
    // 云录制:停止服务端 egress;否则停止本地录制
    if (s.recordingEgressId) {
      const egressId = s.recordingEgressId
      set((prev) => ({ ...prev, recordingEgressId: null }))
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
  if (isRecordingBackendConfigured() && s.callId) {
    try {
      const { egressId, fileUrl } = await startCloudRecording(s.callId)
      set((prev) => ({ ...prev, recordingEgressId: egressId, recordingUrl: fileUrl ?? null, isRecording: true }))
      return
    } catch {
      /* 云录制失败则退回本地录制 */
    }
  }

  await startCallRecording()
  set((prev) => ({ ...prev, isRecording: true }))
}

export function handleSignal(signal: CallSignal) {
  if (signal.senderId === getClient().getUserId()) return
  const content = signal.content
  const signalCallId = typeof content.callId === 'string' ? content.callId : null
  if (!signalCallId) return

  if (signal.type === CALL_INVITE_EVENT) {
    // 占线：自动拒绝新来电
    if (callStore.state.status !== 'idle') {
      void sendCallHangup(signal.roomId, signalCallId, 'busy')
      return
    }
    set((s) => ({
      ...s,
      callId: signalCallId,
      livekitRoom: typeof content.livekitRoom === 'string' ? content.livekitRoom : signalCallId,
      roomId: signal.roomId,
      peerId: signal.senderId,
      peerName: resolvePeerName(signal.roomId, signal.senderId),
      mode: content.mode === 'video' ? 'video' : 'audio',
      direction: 'incoming',
      isMuted: false,
      status: 'incoming',
    }))
    return
  }

  if (signalCallId !== callStore.state.callId) return

  if (signal.type === CALL_ANSWER_EVENT) {
    if (callStore.state.status === 'outgoing') {
      set((s) => ({ ...s, status: 'connected', startedAt: Date.now() }))
    }
    return
  }

  if (signal.type === CALL_HANGUP_EVENT) {
    void endCall()
  }
}

matrixEvents.on('call.signal', handleSignal)

/** Full reset for tests/logout — returns all state to its initial shape. */
export function resetCallStore() {
  set(() => createInitialState())
}

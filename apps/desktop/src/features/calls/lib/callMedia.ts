import type { LocalVideoTrack, Participant, RemoteTrack, RemoteVideoTrack, Room } from 'livekit-client'
import type { CallMode } from '@/matrix/index'
import { shallowRef } from 'vue'
import { getLiveKitToken } from '@/features/server/lib/livekitToken'
import { getClient } from '@/matrix/client'
import { triggerBlobDownload } from '@/shared/lib/download'

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880'

export interface RemoteVideoFeed {
  id: string
  identity: string
  track: RemoteVideoTrack
}

// 模块级单例：同一时间只维持一个通话媒体连接
let room: Room | null = null
const attachedAudio = new Map<string, HTMLMediaElement>()

// 本地录制状态（客户端 MediaRecorder，落盘为 webm）
let mediaRecorder: MediaRecorder | null = null
let recordedChunks: Blob[] = []
let recordingContext: AudioContext | null = null

/** 本地摄像头轨道，供本地预览渲染 */
export const localVideoTrack = shallowRef<LocalVideoTrack | null>(null)
/** 远端视频轨道列表，供通话窗口渲染对端画面 */
export const remoteVideos = shallowRef<RemoteVideoFeed[]>([])

function attachRemoteAudio(track: RemoteTrack) {
  const el = track.attach()
  el.autoplay = true
  el.style.display = 'none'
  document.body.appendChild(el)
  attachedAudio.set(track.sid ?? `${attachedAudio.size}`, el)
}

function addRemoteVideo(track: RemoteVideoTrack, participant: Participant) {
  const id = track.sid ?? `${participant.identity}:${remoteVideos.value.length}`
  remoteVideos.value = [
    ...remoteVideos.value.filter((feed) => feed.id !== id),
    { id, identity: participant.identity, track },
  ]
}

function removeRemoteTrack(track: RemoteTrack) {
  for (const el of track.detach()) el.remove()
  if (track.sid) {
    attachedAudio.get(track.sid)?.remove()
    attachedAudio.delete(track.sid)
    remoteVideos.value = remoteVideos.value.filter((feed) => feed.id !== track.sid)
  }
}

function clearMedia() {
  for (const el of attachedAudio.values()) el.remove()
  attachedAudio.clear()
  localVideoTrack.value = null
  remoteVideos.value = []
}

/** 连接到通话的 LiveKit 房间并发布本地媒体（音频始终发布，视频按模式发布） */
export async function connectCallRoom(livekitRoom: string, mode: CallMode = 'audio'): Promise<void> {
  const livekit = await import('livekit-client')
  const next = new livekit.Room()
  room = next

  next.on(livekit.RoomEvent.TrackSubscribed, (track, _publication, participant) => {
    if (track.kind === 'video') {
      addRemoteVideo(track as RemoteVideoTrack, participant)
    } else if (track.kind === 'audio') {
      attachRemoteAudio(track)
    }
  })
  next.on(livekit.RoomEvent.TrackUnsubscribed, (track) => removeRemoteTrack(track))

  const client = getClient()
  const identity = client.getUserId() || 'local'
  const profile = client.getUser(identity)
  const token = await getLiveKitToken({
    roomName: livekitRoom,
    identity,
    name: profile?.displayName || identity,
  })

  await next.connect(LIVEKIT_URL, token)
  await next.localParticipant.setMicrophoneEnabled(true)
  if (mode === 'video') {
    await setCallCameraEnabled(true)
  }
}

export async function setCallMicEnabled(enabled: boolean): Promise<void> {
  await room?.localParticipant.setMicrophoneEnabled(enabled)
}

export async function setCallCameraEnabled(enabled: boolean): Promise<void> {
  const publication = await room?.localParticipant.setCameraEnabled(enabled)
  localVideoTrack.value = enabled ? (publication?.videoTrack ?? null) : null
}

export async function setCallScreenShareEnabled(enabled: boolean): Promise<void> {
  await room?.localParticipant.setScreenShareEnabled(enabled)
}

export function isCallRecordingSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof AudioContext !== 'undefined'
}

/** 收集房间内所有已发布/已订阅的本地与远端媒体轨 */
function collectRecordingTracks(): { audio: MediaStreamTrack[]; video: MediaStreamTrack[] } {
  const audio: MediaStreamTrack[] = []
  const video: MediaStreamTrack[] = []
  if (!room) return { audio, video }

  const participants: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()]
  for (const participant of participants) {
    participant.trackPublications.forEach((publication) => {
      const mst = publication.track?.mediaStreamTrack
      if (!mst) return
      if (publication.kind === 'audio') audio.push(mst)
      else if (publication.kind === 'video') video.push(mst)
    })
  }
  return { audio, video }
}

/** 开始本地录制：用 WebAudio 混合所有音轨，附带首个视频轨，交给 MediaRecorder */
export async function startCallRecording(): Promise<void> {
  if (!room || mediaRecorder || !isCallRecordingSupported()) return

  const { audio, video } = collectRecordingTracks()
  if (audio.length === 0 && video.length === 0) return

  const mixed = new MediaStream()
  if (audio.length > 0) {
    const ctx = new AudioContext()
    recordingContext = ctx
    const destination = ctx.createMediaStreamDestination()
    for (const track of audio) {
      ctx.createMediaStreamSource(new MediaStream([track])).connect(destination)
    }
    for (const track of destination.stream.getAudioTracks()) mixed.addTrack(track)
  }
  if (video[0]) mixed.addTrack(video[0])

  const preferred = 'video/webm;codecs=vp8,opus'
  const mimeType = video[0] && MediaRecorder.isTypeSupported(preferred) ? preferred : 'video/webm'
  const recorder = new MediaRecorder(mixed, video[0] ? { mimeType } : undefined)
  recordedChunks = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) recordedChunks.push(event.data)
  }
  recorder.start()
  mediaRecorder = recorder
}

/** 停止本地录制并把录像落盘 */
export async function stopCallRecording(): Promise<void> {
  const recorder = mediaRecorder
  mediaRecorder = null
  if (!recorder) return

  const chunks = recordedChunks
  recordedChunks = []

  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
    if (recorder.state !== 'inactive') recorder.stop()
    else resolve()
  })

  try {
    await recordingContext?.close()
  } catch {
    /* 已关闭则忽略 */
  }
  recordingContext = null

  if (chunks.length > 0) {
    const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    triggerBlobDownload(blob, `call-recording-${stamp}.webm`)
  }
}

export async function disconnectCallRoom(): Promise<void> {
  await stopCallRecording().catch(() => {})

  const active = room
  room = null
  if (active) {
    active.removeAllListeners()
    try {
      await active.disconnect()
    } catch {
      /* 已断开则忽略 */
    }
  }
  clearMedia()
}

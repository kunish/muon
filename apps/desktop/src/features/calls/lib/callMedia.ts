import type { RemoteTrack, Room } from 'livekit-client'
import { getLiveKitToken } from '@/features/server/lib/livekitToken'
import { getClient } from '@/matrix/client'

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880'

// 模块级单例：同一时间只维持一个通话媒体连接
let room: Room | null = null
const attachedElements = new Map<string, HTMLMediaElement>()

function attachRemoteTrack(track: RemoteTrack) {
  if (track.kind !== 'audio') return
  const el = track.attach()
  el.autoplay = true
  el.style.display = 'none'
  document.body.appendChild(el)
  attachedElements.set(track.sid ?? `${attachedElements.size}`, el)
}

function detachAll() {
  for (const el of attachedElements.values()) el.remove()
  attachedElements.clear()
}

/** 连接到通话的 LiveKit 房间并发布麦克风（P1 仅音频） */
export async function connectCallRoom(livekitRoom: string): Promise<void> {
  const livekit = await import('livekit-client')
  const next = new livekit.Room()
  room = next

  next.on(livekit.RoomEvent.TrackSubscribed, (track) => attachRemoteTrack(track))
  next.on(livekit.RoomEvent.TrackUnsubscribed, (track) => {
    for (const el of track.detach()) el.remove()
  })

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
}

export async function setCallMicEnabled(enabled: boolean): Promise<void> {
  await room?.localParticipant.setMicrophoneEnabled(enabled)
}

export async function disconnectCallRoom(): Promise<void> {
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
  detachAll()
}

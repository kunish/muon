import type { Room } from 'livekit-client'
import type { VoiceConnection } from '../stores/serverStore'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { computed, ref, shallowRef } from 'vue'
import { toast } from 'vue-sonner'
import { getClient } from '@/matrix/client'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { localizedText } from '@/shared/lib/localizedText'
import { getLiveKitToken } from '../lib/livekitToken'
import { useServerStore } from '../stores/serverStore'

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880'

// ── Types ──

export interface VoiceChannelUser {
  userId: string
  displayName: string
  avatarUrl?: string
  isMuted: boolean
  isDeafened: boolean
}

// ── Module-level singleton state ──
// Shared across all component instances that call useVoiceChannel()

const room = shallowRef<Room | null>(null)
const isConnected = ref(false)
const isConnecting = ref(false)
const isMuted = ref(false)
const isDeafened = ref(false)
const wasMutedBeforeDeafen = ref(false)
const currentChannelId = ref<string | null>(null)
const connectedUsers = ref<VoiceChannelUser[]>([])

// ── Composable ──

export function useVoiceChannel() {
  const serverStore = useServerStore()

  /** Add the current user to the local connected-users list */
  function addSelfToUsers() {
    const client = getClient()
    const userId = client.getUserId()
    if (!userId) return

    const user = client.getUser(userId)
    connectedUsers.value = [
      ...connectedUsers.value,
      {
        userId,
        displayName: user?.displayName || userId.split(':')[0].slice(1),
        avatarUrl: user?.avatarUrl || undefined,
        isMuted: isMuted.value,
        isDeafened: isDeafened.value,
      },
    ]
  }

  /** Remove the current user from the local connected-users list */
  function removeSelfFromUsers() {
    const client = getClient()
    const userId = client.getUserId()
    if (!userId) return
    connectedUsers.value = connectedUsers.value.filter((u) => u.userId !== userId)
  }

  /** Update the current user's mute/deafen state in the local list */
  function updateSelfInUsers() {
    const client = getClient()
    const userId = client.getUserId()
    if (!userId) return

    connectedUsers.value = connectedUsers.value.map((u) =>
      u.userId === userId ? { ...u, isMuted: isMuted.value, isDeafened: isDeafened.value } : u,
    )
  }

  /** Connect to a voice channel's LiveKit room */
  function joinVoiceChannelEffect(roomId: string, channelName: string, serverId: string): DesktopEffect<void> {
    return Effect.gen(function* () {
      if (currentChannelId.value === roomId && isConnected.value) return

      if (isConnected.value) {
        yield* leaveVoiceChannelEffect()
      }

      yield* fromSync(() => {
        isConnecting.value = true
        currentChannelId.value = roomId
      })

      const livekit = yield* fromPromise(() => import('livekit-client'))
      const nextRoom = new livekit.Room()
      yield* fromSync(() => {
        room.value = nextRoom

        nextRoom.on(livekit.RoomEvent.Connected, () => {
          isConnected.value = true
          isConnecting.value = false
        })

        nextRoom.on(livekit.RoomEvent.Disconnected, () => {
          resetState()
        })
      })

      const tokenRequest = yield* fromSync(() => {
        const client = getClient()
        const identity = client.getUserId() || 'local'
        const profile = client.getUser(identity)
        return {
          roomName: roomId,
          identity,
          name: profile?.displayName || identity,
          metadata: JSON.stringify({ matrixRoomId: roomId, serverId, channelName }),
        }
      })
      const token = yield* fromPromise(() => getLiveKitToken(tokenRequest))
      yield* fromPromise(() => nextRoom.connect(LIVEKIT_URL, token))
      yield* fromPromise(() => nextRoom.localParticipant.setMicrophoneEnabled(!isMuted.value))

      yield* fromSync(() => {
        const connection: VoiceConnection = { channelId: roomId, channelName, serverId }
        serverStore.setVoiceConnection(connection)
        addSelfToUsers()
      })
    }).pipe(
      Effect.catchAll((err) =>
        fromSync(() => {
          console.error('[useVoiceChannel] Failed to join:', err)
          toast.error(localizedText('server.voice_join_failed'))
          resetState()
        }),
      ),
    )
  }

  function joinVoiceChannel(roomId: string, channelName: string, serverId: string) {
    return runDesktopEffect(joinVoiceChannelEffect(roomId, channelName, serverId))
  }

  /** Disconnect from the current voice channel */
  function leaveVoiceChannelEffect(): DesktopEffect<void> {
    return Effect.gen(function* () {
      const activeRoom = room.value
      if (activeRoom) {
        yield* fromSync(() => activeRoom.removeAllListeners())
        yield* fromPromise(() => activeRoom.disconnect()).pipe(Effect.catchAll(() => Effect.succeed(undefined)))
        yield* fromSync(() => {
          room.value = null
        })
      }

      yield* fromSync(() => {
        removeSelfFromUsers()
        resetState()
      })
    })
  }

  function leaveVoiceChannel() {
    return runDesktopEffect(leaveVoiceChannelEffect())
  }

  /** Switch from the current voice channel to a new one */
  function switchVoiceChannelEffect(newRoomId: string, channelName: string, serverId: string): DesktopEffect<void> {
    return Effect.gen(function* () {
      yield* leaveVoiceChannelEffect()
      yield* joinVoiceChannelEffect(newRoomId, channelName, serverId)
    })
  }

  function switchVoiceChannel(newRoomId: string, channelName: string, serverId: string) {
    return runDesktopEffect(switchVoiceChannelEffect(newRoomId, channelName, serverId))
  }

  /** Toggle microphone mute */
  function toggleMuteEffect(): DesktopEffect<void> {
    return Effect.gen(function* () {
      yield* fromSync(() => {
        isMuted.value = !isMuted.value
      })

      if (room.value) {
        yield* fromPromise(() => room.value!.localParticipant.setMicrophoneEnabled(!isMuted.value)).pipe(
          Effect.catchAll(() =>
            fromSync(() => {
              isMuted.value = !isMuted.value
              toast.error(localizedText('server.microphone_toggle_failed'))
            }),
          ),
        )
      }

      yield* fromSync(() => updateSelfInUsers())
    })
  }

  function toggleMute() {
    return runDesktopEffect(toggleMuteEffect())
  }

  /** Toggle deafen (mutes audio output; also mutes mic when deafened) */
  function toggleDeafenEffect(): DesktopEffect<void> {
    return Effect.gen(function* () {
      yield* fromSync(() => {
        const nextDeafened = !isDeafened.value
        if (nextDeafened) wasMutedBeforeDeafen.value = isMuted.value
        isDeafened.value = nextDeafened
      })

      if (isDeafened.value && !isMuted.value) {
        yield* fromSync(() => {
          isMuted.value = true
        })
        if (room.value) {
          yield* fromPromise(() => room.value!.localParticipant.setMicrophoneEnabled(false)).pipe(
            Effect.catchAll(() => fromSync(() => toast.error(localizedText('server.microphone_toggle_failed')))),
          )
        }
      }

      if (!isDeafened.value && isMuted.value && !wasMutedBeforeDeafen.value) {
        yield* fromSync(() => {
          isMuted.value = false
        })
        if (room.value) {
          yield* fromPromise(() => room.value!.localParticipant.setMicrophoneEnabled(true)).pipe(
            Effect.catchAll(() => fromSync(() => toast.error(localizedText('server.microphone_toggle_failed')))),
          )
        }
      }

      yield* fromSync(() => {
        if (!isDeafened.value) wasMutedBeforeDeafen.value = false
        updateSelfInUsers()
      })
    })
  }

  function toggleDeafen() {
    return runDesktopEffect(toggleDeafenEffect())
  }

  /** Reset all local state and clear store connection */
  function resetState() {
    isConnected.value = false
    isConnecting.value = false
    isMuted.value = false
    isDeafened.value = false
    wasMutedBeforeDeafen.value = false
    currentChannelId.value = null
    room.value = null
    serverStore.setVoiceConnection(null)
  }

  return {
    // Reactive state
    isConnected: computed(() => isConnected.value),
    isConnecting: computed(() => isConnecting.value),
    isMuted: computed(() => isMuted.value),
    isDeafened: computed(() => isDeafened.value),
    currentChannelId: computed(() => currentChannelId.value),
    connectedUsers: computed(() => connectedUsers.value),

    // Actions
    joinVoiceChannelEffect,
    leaveVoiceChannelEffect,
    switchVoiceChannelEffect,
    toggleMuteEffect,
    toggleDeafenEffect,
    joinVoiceChannel,
    leaveVoiceChannel,
    switchVoiceChannel,
    toggleMute,
    toggleDeafen,
  }
}

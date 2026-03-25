import type { Room } from 'livekit-client'
import type { VoiceConnection } from '../stores/serverStore'
import { computed, ref, shallowRef } from 'vue'
import { toast } from 'vue-sonner'
import { getClient } from '@/matrix/client'
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
const currentChannelId = ref<string | null>(null)
const connectedUsers = ref<VoiceChannelUser[]>([])

// ── Composable ──

export function useVoiceChannel() {
  const serverStore = useServerStore()

  /** Add the current user to the mock connected-users list */
  function addSelfToUsers() {
    const client = getClient()
    const userId = client.getUserId()
    if (!userId)
      return

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

  /** Remove the current user from the mock connected-users list */
  function removeSelfFromUsers() {
    const client = getClient()
    const userId = client.getUserId()
    if (!userId)
      return
    connectedUsers.value = connectedUsers.value.filter(u => u.userId !== userId)
  }

  /** Update the current user's mute/deafen state in the mock list */
  function updateSelfInUsers() {
    const client = getClient()
    const userId = client.getUserId()
    if (!userId)
      return

    connectedUsers.value = connectedUsers.value.map(u =>
      u.userId === userId
        ? { ...u, isMuted: isMuted.value, isDeafened: isDeafened.value }
        : u,
    )
  }

  /** Connect to a voice channel's LiveKit room */
  async function joinVoiceChannel(roomId: string, channelName: string, serverId: string) {
    // Already connected to this channel
    if (currentChannelId.value === roomId && isConnected.value)
      return

    // Disconnect from any existing voice channel first
    if (isConnected.value) {
      await leaveVoiceChannel()
    }

    isConnecting.value = true
    currentChannelId.value = roomId

    try {
      const { Room, RoomEvent } = await import('livekit-client')
      room.value = new Room()

      room.value.on(RoomEvent.Connected, () => {
        isConnected.value = true
        isConnecting.value = false
      })

      room.value.on(RoomEvent.Disconnected, () => {
        resetState()
      })

      // Token would come from server in production; use roomId as placeholder
      await room.value.connect(LIVEKIT_URL, roomId)

      // Enable microphone by default (not deafened)
      await room.value.localParticipant.setMicrophoneEnabled(!isMuted.value)

      // Update store
      const connection: VoiceConnection = { channelId: roomId, channelName, serverId }
      serverStore.setVoiceConnection(connection)

      // Add self to mock participant list
      addSelfToUsers()
    }
    catch (err) {
      console.error('[useVoiceChannel] Failed to join:', err)
      toast.error('Could not join voice channel')
      resetState()
    }
  }

  /** Disconnect from the current voice channel */
  async function leaveVoiceChannel() {
    if (room.value) {
      try {
        await room.value.disconnect()
      }
      catch {
        // Ignore disconnect errors
      }
      room.value = null
    }

    removeSelfFromUsers()
    resetState()
  }

  /** Switch from the current voice channel to a new one */
  async function switchVoiceChannel(newRoomId: string, channelName: string, serverId: string) {
    await leaveVoiceChannel()
    await joinVoiceChannel(newRoomId, channelName, serverId)
  }

  /** Toggle microphone mute */
  async function toggleMute() {
    isMuted.value = !isMuted.value

    if (room.value) {
      try {
        await room.value.localParticipant.setMicrophoneEnabled(!isMuted.value)
      }
      catch {
        isMuted.value = !isMuted.value
        toast.error('Microphone toggle failed')
      }
    }

    updateSelfInUsers()
  }

  /** Toggle deafen (mutes audio output; also mutes mic when deafened) */
  async function toggleDeafen() {
    isDeafened.value = !isDeafened.value

    // Deafening also mutes mic
    if (isDeafened.value && !isMuted.value) {
      isMuted.value = true
      if (room.value) {
        try {
          await room.value.localParticipant.setMicrophoneEnabled(false)
        }
        catch {
          toast.error('Microphone toggle failed')
        }
      }
    }

    // Un-deafening restores mic to unmuted
    if (!isDeafened.value && isMuted.value) {
      isMuted.value = false
      if (room.value) {
        try {
          await room.value.localParticipant.setMicrophoneEnabled(true)
        }
        catch {
          toast.error('Microphone toggle failed')
        }
      }
    }

    updateSelfInUsers()
  }

  /** Reset all local state and clear store connection */
  function resetState() {
    isConnected.value = false
    isConnecting.value = false
    isMuted.value = false
    isDeafened.value = false
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
    joinVoiceChannel,
    leaveVoiceChannel,
    switchVoiceChannel,
    toggleMute,
    toggleDeafen,
  }
}

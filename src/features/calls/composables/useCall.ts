import type { Room } from 'livekit-client'
import type { CallType } from '../types'
import { shallowRef } from 'vue'
import { toast } from 'vue-sonner'
import { useCallStore } from '../stores/callStore'

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880'

export function useCall() {
  const store = useCallStore()
  const room = shallowRef<Room | null>(null)

  async function startCall(roomId: string, type: CallType) {
    const callId = `call_${Date.now()}`
    store.startCall(roomId, callId, type, 'local')

    try {
      const { Room, RoomEvent } = await import('livekit-client')
      room.value = new Room()

      room.value.on(RoomEvent.Connected, () => {
        store.setConnected()
      })

      room.value.on(RoomEvent.Disconnected, () => {
        store.endCall()
        room.value = null
      })

      // In production, token would come from server
      // For now, connect with placeholder
      await room.value.connect(LIVEKIT_URL, callId)

      if (type === 'video') {
        await room.value.localParticipant.setCameraEnabled(true)
        store.isCameraOff = false
      }
      await room.value.localParticipant.setMicrophoneEnabled(true)
    }
    catch (err) {
      console.error('[useCall] Failed to start call:', err)
      toast.error('Could not start call')
      store.endCall()
    }
  }

  async function toggleMute() {
    if (!room.value)
      return
    const prev = store.isMuted
    store.isMuted = !store.isMuted
    try {
      await room.value.localParticipant.setMicrophoneEnabled(!store.isMuted)
    }
    catch {
      store.isMuted = prev
      toast.error('Microphone toggle failed')
    }
  }

  async function toggleCamera() {
    if (!room.value)
      return
    const prev = store.isCameraOff
    store.isCameraOff = !store.isCameraOff
    try {
      await room.value.localParticipant.setCameraEnabled(!store.isCameraOff)
    }
    catch {
      store.isCameraOff = prev
      toast.error('Camera toggle failed')
    }
  }

  async function toggleScreenShare() {
    if (!room.value)
      return
    const prev = store.isScreenSharing
    store.isScreenSharing = !store.isScreenSharing
    try {
      await room.value.localParticipant.setScreenShareEnabled(store.isScreenSharing)
    }
    catch {
      store.isScreenSharing = prev
      toast.error('Screen share toggle failed')
    }
  }

  async function hangUp() {
    if (room.value) {
      await room.value.disconnect()
      room.value = null
    }
    store.endCall()
  }

  return {
    room,
    startCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    hangUp,
  }
}

import type { CallType } from '../types'
import { ref } from 'vue'
import { useCallStore } from '../stores/callStore'

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880'

export function useCall() {
  const store = useCallStore()
  const room = ref<any>(null)

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
    catch {
      store.endCall()
    }
  }

  async function toggleMute() {
    if (!room.value)
      return
    store.isMuted = !store.isMuted
    await room.value.localParticipant.setMicrophoneEnabled(!store.isMuted)
  }

  async function toggleCamera() {
    if (!room.value)
      return
    store.isCameraOff = !store.isCameraOff
    await room.value.localParticipant.setCameraEnabled(!store.isCameraOff)
  }

  async function toggleScreenShare() {
    if (!room.value)
      return
    store.isScreenSharing = !store.isScreenSharing
    await room.value.localParticipant.setScreenShareEnabled(store.isScreenSharing)
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

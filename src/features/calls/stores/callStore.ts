import type { CallInfo, CallState, CallType } from '../types'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCallStore = defineStore('call', () => {
  const state = ref<CallState>('idle')
  const currentCall = ref<CallInfo | null>(null)
  const isMuted = ref(false)
  const isCameraOff = ref(true)
  const isScreenSharing = ref(false)

  function startCall(roomId: string, callId: string, type: CallType, initiator: string) {
    currentCall.value = { roomId, callId, type, initiator, participants: [initiator] }
    state.value = 'connecting'
  }

  function setConnected() {
    state.value = 'connected'
    if (currentCall.value)
      currentCall.value.startedAt = Date.now()
  }

  function endCall() {
    if (currentCall.value)
      currentCall.value.endedAt = Date.now()
    state.value = 'ended'
    setTimeout(() => {
      state.value = 'idle'
      currentCall.value = null
      isMuted.value = false
      isCameraOff.value = true
      isScreenSharing.value = false
    }, 1000)
  }

  return {
    state,
    currentCall,
    isMuted,
    isCameraOff,
    isScreenSharing,
    startCall,
    setConnected,
    endCall,
  }
})

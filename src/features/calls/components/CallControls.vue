<script setup lang="ts">
import { Camera, CameraOff, Mic, MicOff, Monitor, PhoneOff } from 'lucide-vue-next'

defineProps<{
  muted: boolean
  cameraOff: boolean
  screenSharing: boolean
}>()

const emit = defineEmits<{
  toggleMute: []
  toggleCamera: []
  toggleScreenShare: []
  hangUp: []
}>()
</script>

<template>
  <div class="flex items-center justify-center gap-3 p-3">
    <button
      class="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
      :class="muted ? 'bg-destructive/20 text-destructive' : 'bg-muted hover:bg-accent'"
      @click="emit('toggleMute')"
    >
      <MicOff v-if="muted" :size="18" />
      <Mic v-else :size="18" />
    </button>

    <button
      class="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
      :class="cameraOff ? 'bg-muted hover:bg-accent' : 'bg-primary/20 text-primary'"
      @click="emit('toggleCamera')"
    >
      <CameraOff v-if="cameraOff" :size="18" />
      <Camera v-else :size="18" />
    </button>

    <button
      class="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
      :class="screenSharing ? 'bg-primary/20 text-primary' : 'bg-muted hover:bg-accent'"
      @click="emit('toggleScreenShare')"
    >
      <Monitor :size="18" />
    </button>

    <button
      class="w-12 h-10 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90"
      @click="emit('hangUp')"
    >
      <PhoneOff :size="18" />
    </button>
  </div>
</template>

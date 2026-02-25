<script setup lang="ts">
import { computed } from 'vue'
import { useCall } from '../composables/useCall'
import { useCallStore } from '../stores/callStore'
import CallControls from './CallControls.vue'
import VideoGrid from './VideoGrid.vue'

const store = useCallStore()
const { toggleMute, toggleCamera, toggleScreenShare, hangUp } = useCall()

const isActive = computed(() =>
  store.state === 'connecting' || store.state === 'connected',
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isActive"
      class="fixed bottom-4 right-4 z-40 w-[360px] h-[280px] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
    >
      <div class="flex-1 bg-muted">
        <VideoGrid :participants="[]" />
      </div>
      <CallControls
        :muted="store.isMuted"
        :camera-off="store.isCameraOff"
        :screen-sharing="store.isScreenSharing"
        @toggle-mute="toggleMute"
        @toggle-camera="toggleCamera"
        @toggle-screen-share="toggleScreenShare"
        @hang-up="hangUp"
      />
    </div>
  </Teleport>
</template>

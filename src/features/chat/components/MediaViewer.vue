<script setup lang="ts">
import { Download, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-vue-next'
import { ref } from 'vue'
import { useMediaViewer } from '../composables/useMediaViewer'

const { visible, currentUrl, currentType, close } = useMediaViewer()

const scale = ref(1)
const rotation = ref(0)

function zoomIn() {
  scale.value = Math.min(scale.value + 0.25, 3)
}
function zoomOut() {
  scale.value = Math.max(scale.value - 0.25, 0.25)
}
function rotate() {
  rotation.value = (rotation.value + 90) % 360
}

function download() {
  const a = document.createElement('a')
  a.href = currentUrl.value
  a.download = ''
  a.target = '_blank'
  a.click()
}

function onBackdrop(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    resetAndClose()
  }
}

function resetAndClose() {
  scale.value = 1
  rotation.value = 0
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape')
    resetAndClose()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
      @click="onBackdrop"
      @keydown="onKeydown"
    >
      <!-- Toolbar -->
      <div class="absolute top-4 right-4 flex items-center gap-2 z-10">
        <template v-if="currentType === 'image'">
          <button class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white" @click="zoomIn">
            <ZoomIn :size="18" />
          </button>
          <button class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white" @click="zoomOut">
            <ZoomOut :size="18" />
          </button>
          <button class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white" @click="rotate">
            <RotateCw :size="18" />
          </button>
        </template>
        <button class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white" @click="download">
          <Download :size="18" />
        </button>
        <button class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white" @click="resetAndClose">
          <X :size="18" />
        </button>
      </div>

      <!-- Content -->
      <img
        v-if="currentType === 'image'"
        :src="currentUrl"
        class="max-w-[90vw] max-h-[90vh] object-contain transition-transform"
        :style="{ transform: `scale(${scale}) rotate(${rotation}deg)` }"
      >
      <video
        v-else
        :src="currentUrl"
        controls
        autoplay
        class="max-w-[90vw] max-h-[90vh]"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { FileUp, ImagePlus, Plus, Video } from 'lucide-vue-next'
import { ref } from 'vue'

const emit = defineEmits<{
  image: [file: File]
  video: [file: File]
  file: [file: File]
}>()

const open = ref(false)

function pickFile(accept: string, type: 'image' | 'video' | 'file') {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.onchange = () => {
    const file = input.files?.[0]
    if (file)
      (emit as any)(type, file)
  }
  input.click()
  open.value = false
}
</script>

<template>
  <div class="relative">
    <button
      class="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
      @click="open = !open"
    >
      <Plus :size="18" />
    </button>
    <div
      v-if="open"
      class="absolute bottom-full left-0 mb-2 bg-background border border-border rounded-lg shadow-lg py-1 min-w-[140px] z-10"
    >
      <button
        class="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-accent"
        @click="pickFile('image/*', 'image')"
      >
        <ImagePlus :size="16" />
        图片
      </button>
      <button
        class="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-accent"
        @click="pickFile('video/*', 'video')"
      >
        <Video :size="16" />
        视频
      </button>
      <button
        class="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-accent"
        @click="pickFile('*', 'file')"
      >
        <FileUp :size="16" />
        文件
      </button>
    </div>
  </div>
</template>

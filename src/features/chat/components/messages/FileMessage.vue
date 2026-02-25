<script setup lang="ts">
import { downloadMedia } from '@matrix/index'
import { Download, FileText } from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{
  event: any
}>()

const content = computed(() => props.event.getContent())
const fileName = computed(() => content.value?.body || '未知文件')
const fileSize = computed(() => {
  const bytes = content.value?.info?.size || 0
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
})

async function download() {
  const url = content.value?.url
  if (!url)
    return
  const blob = await downloadMedia(url)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = fileName.value
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <div
    class="flex items-center gap-3 p-2 rounded-lg bg-background/50 cursor-pointer min-w-[200px]"
    @click="download"
  >
    <div class="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
      <FileText :size="20" />
    </div>
    <div class="flex-1 min-w-0">
      <div class="text-sm truncate">
        {{ fileName }}
      </div>
      <div class="text-xs text-muted-foreground">
        {{ fileSize }}
      </div>
    </div>
    <Download :size="16" class="text-muted-foreground shrink-0" />
  </div>
</template>

<script setup lang="ts">
import type { MatrixEvent } from 'matrix-js-sdk'
import { downloadMedia } from '@matrix/index'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { Copy, Download, FileText, Forward } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  event: MatrixEvent
}>()

const { t } = useI18n()

const content = computed(() => props.event.getContent())
const fileName = computed(() => content.value?.body || t('chat.unknown_file'))
const fileSize = computed(() => {
  const bytes = content.value?.info?.size || 0
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
})

const fileExt = computed(() => {
  const name = fileName.value
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toUpperCase() : ''
})

const fileIconColor = computed(() => {
  const ext = fileExt.value.toLowerCase()
  const colorMap: Record<string, string> = {
    'pdf': 'text-red-500 bg-red-50 dark:bg-red-950/30',
    'doc': 'text-blue-500 bg-blue-50 dark:bg-blue-950/30',
    'docx': 'text-blue-500 bg-blue-50 dark:bg-blue-950/30',
    'xls': 'text-green-500 bg-green-50 dark:bg-green-950/30',
    'xlsx': 'text-green-500 bg-green-50 dark:bg-green-950/30',
    'ppt': 'text-orange-500 bg-orange-50 dark:bg-orange-950/30',
    'pptx': 'text-orange-500 bg-orange-50 dark:bg-orange-950/30',
    'zip': 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30',
    'rar': 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30',
    '7z': 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30',
    'mp3': 'text-purple-500 bg-purple-50 dark:bg-purple-950/30',
    'mp4': 'text-pink-500 bg-pink-50 dark:bg-pink-950/30',
  }
  return colorMap[ext] || 'text-primary bg-primary/10'
})

const downloading = ref(false)
const downloadError = ref('')
const toastMessage = ref('')

function showToast(msg: string) {
  toastMessage.value = msg
  setTimeout(() => { toastMessage.value = '' }, 2000)
}

async function download() {
  if (downloading.value)
    return
  downloading.value = true
  downloadError.value = ''
  try {
    const url = content.value?.url
    if (!url)
      return
    const blob = await downloadMedia(url)
    const a = document.createElement('a')
    const blobUrl = URL.createObjectURL(blob)
    a.href = blobUrl
    a.download = fileName.value
    a.click()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    showToast(t('chat.download_complete'))
  }
  catch (e) {
    downloadError.value = t('chat.download_failed')
    showToast(t('chat.download_failed_retry'))
  }
  finally {
    downloading.value = false
  }
}

async function saveAs() {
  try {
    const url = content.value?.url
    if (!url)
      return
    const filePath = await save({
      defaultPath: fileName.value,
    })
    if (!filePath)
      return
    downloading.value = true
    const blob = await downloadMedia(url)
    const arrayBuffer = await blob.arrayBuffer()
    await writeFile(filePath, new Uint8Array(arrayBuffer))
    showToast(t('chat.saved_locally'))
  }
  catch {
    showToast(t('chat.save_failed'))
  }
  finally {
    downloading.value = false
  }
}

function forward() {
  showToast(t('chat.forward_wip'))
}
</script>

<template>
  <div class="file-card relative min-w-[260px] max-w-[360px]">
    <!-- File info row -->
    <div class="flex items-start gap-3 p-3">
      <div
        class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        :class="fileIconColor"
      >
        <FileText :size="20" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium truncate leading-tight">
          {{ fileName }}
        </div>
        <div class="text-xs text-muted-foreground mt-0.5">
          {{ fileSize }}
        </div>
      </div>
    </div>

    <!-- Action buttons (Feishu style) -->
    <div class="flex items-center border-t border-border/40 divide-x divide-border/40">
      <button
        class="file-action-btn flex-1"
        :disabled="downloading"
        @click.stop="download"
      >
        <Download :size="14" />
        <span>{{ downloading ? t('chat.downloading') : t('chat.download') }}</span>
      </button>
      <button class="file-action-btn flex-1" @click.stop="forward">
        <Forward :size="14" />
        <span>{{ t('chat.forward') }}</span>
      </button>
      <button class="file-action-btn flex-1" @click.stop="saveAs">
        <Copy :size="14" />
        <span>{{ t('chat.save_as') }}</span>
      </button>
    </div>

    <!-- Toast -->
    <Transition name="toast-fade">
      <div
        v-if="toastMessage"
        class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-foreground/90 text-background text-xs whitespace-nowrap shadow-lg"
      >
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.file-card {
  border-radius: 8px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  overflow: hidden;
  transition: box-shadow 0.2s ease;
}
.file-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.file-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px 0;
  font-size: 12px;
  color: var(--color-muted-foreground);
  cursor: pointer;
  transition: all 0.15s ease;
}
.file-action-btn:hover {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 5%, transparent);
}
.file-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.2s ease;
}
.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 4px);
}
</style>

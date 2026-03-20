<script setup lang="ts">
import type { MatrixEvent } from 'matrix-js-sdk'
import { downloadMedia } from '@matrix/index'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { Copy, Download, FileText, Forward } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { triggerBlobDownload } from '@/shared/lib/download'

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
    'pdf': 'text-destructive bg-destructive/5',
    'doc': 'text-primary bg-primary/5',
    'docx': 'text-primary bg-primary/5',
    'xls': 'text-success bg-success/5',
    'xlsx': 'text-success bg-success/5',
    'ppt': 'text-warning bg-warning/5',
    'pptx': 'text-warning bg-warning/5',
    'zip': 'text-warning bg-warning/5',
    'rar': 'text-warning bg-warning/5',
    '7z': 'text-warning bg-warning/5',
    'mp3': 'text-secondary bg-secondary/5',
    'mp4': 'text-destructive/70 bg-destructive/5',
  }
  return colorMap[ext] || 'text-primary bg-primary/10'
})

const downloading = ref(false)
const downloadError = ref('')
const toastMessage = ref('')

function showToast(msg: string) {
  toastMessage.value = msg
  setTimeout(() => {
    toastMessage.value = ''
  }, 2000)
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
    triggerBlobDownload(blob, fileName.value)
    showToast(t('chat.download_complete'))
  }
  catch {
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
  <div class="relative min-w-[260px] max-w-[360px] overflow-hidden rounded-lg border border-border bg-background transition-shadow duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
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
        class="flex flex-1 cursor-pointer items-center justify-center gap-1 py-[7px] text-xs text-muted-foreground transition-all duration-150 hover:bg-[color-mix(in_srgb,var(--color-primary)_5%,transparent)] hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="downloading"
        @click.stop="download"
      >
        <Download :size="14" />
        <span>{{ downloading ? t('chat.downloading') : t('chat.download') }}</span>
      </button>
      <button class="flex flex-1 cursor-pointer items-center justify-center gap-1 py-[7px] text-xs text-muted-foreground transition-all duration-150 hover:bg-[color-mix(in_srgb,var(--color-primary)_5%,transparent)] hover:text-primary" @click.stop="forward">
        <Forward :size="14" />
        <span>{{ t('chat.forward') }}</span>
      </button>
      <button class="flex flex-1 cursor-pointer items-center justify-center gap-1 py-[7px] text-xs text-muted-foreground transition-all duration-150 hover:bg-[color-mix(in_srgb,var(--color-primary)_5%,transparent)] hover:text-primary" @click.stop="saveAs">
        <Copy :size="14" />
        <span>{{ t('chat.save_as') }}</span>
      </button>
    </div>

    <!-- Toast -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-x-1/2 translate-y-1"
      leave-to-class="opacity-0 -translate-x-1/2 translate-y-1"
    >
      <div
        v-if="toastMessage"
        class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-foreground/90 text-background text-xs whitespace-nowrap shadow-lg"
      >
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

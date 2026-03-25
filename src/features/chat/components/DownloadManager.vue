<script setup lang="ts">
import type { DownloadItem } from '../stores/downloadStore'
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  FolderOpen,
  Trash2,
  X,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Progress } from '@/shared/components/ui/progress'
import { useDownloadStore } from '../stores/downloadStore'

defineEmits<{ close: [] }>()

const { t } = useI18n()
const downloadStore = useDownloadStore()

const hasCompleted = computed(() =>
  downloadStore.items.some(i => i.status === 'completed'),
)

function formatSize(bytes: number): string {
  if (bytes === 0)
    return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`
}

function progressPercent(item: DownloadItem): number {
  if (item.size === 0)
    return 0
  return Math.round((item.downloaded / item.size) * 100)
}

const statusIcon: Record<DownloadItem['status'], typeof Download> = {
  pending: Clock,
  downloading: Download,
  completed: CheckCircle2,
  failed: AlertCircle,
}

const statusColor: Record<DownloadItem['status'], string> = {
  pending: 'text-muted-foreground',
  downloading: 'text-primary',
  completed: 'text-success',
  failed: 'text-destructive',
}

async function openFile(item: DownloadItem) {
  if (item.savePath) {
    try {
      await openPath(item.savePath)
    }
    catch {
      toast.error('Could not open file — it may have been moved or deleted')
    }
  }
}

async function openFolder(item: DownloadItem) {
  if (item.savePath) {
    try {
      await revealItemInDir(item.savePath)
    }
    catch {
      toast.error('Could not open folder')
    }
  }
}
</script>

<template>
  <aside class="flex flex-col h-full w-80 bg-background border-l border-border">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-border">
      <h2 class="text-sm font-semibold">
        {{ t('downloads.title') }}
      </h2>
      <div class="flex items-center gap-1">
        <button
          v-if="hasCompleted"
          class="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent transition-colors"
          @click="downloadStore.clearCompleted()"
        >
          {{ t('downloads.clear_completed') }}
        </button>
        <button
          class="flex items-center justify-center w-7 h-7 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          @click="$emit('close')"
        >
          <X :size="16" />
        </button>
      </div>
    </div>

    <!-- List -->
    <div class="flex-1 overflow-y-auto">
      <!-- Empty state -->
      <div
        v-if="downloadStore.items.length === 0"
        class="flex flex-col items-center justify-center h-full text-muted-foreground gap-2"
      >
        <Download :size="32" :stroke-width="1.5" />
        <span class="text-sm">{{ t('downloads.empty') }}</span>
      </div>

      <!-- Download items -->
      <div
        v-for="item in downloadStore.items"
        :key="item.id"
        class="px-4 py-3 border-b border-border hover:bg-accent/50 transition-colors group"
      >
        <div class="flex items-start gap-3">
          <div class="mt-0.5" :class="statusColor[item.status]">
            <component :is="statusIcon[item.status]" :size="16" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium truncate">{{ item.fileName }}</span>
              <button
                class="flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                @click="downloadStore.removeDownload(item.id)"
              >
                <Trash2 :size="14" />
              </button>
            </div>

            <!-- Progress bar for downloading/pending -->
            <div
              v-if="item.status === 'downloading' || item.status === 'pending'"
              class="mt-1.5"
            >
              <Progress :model-value="progressPercent(item)" class="h-1.5" />
              <div class="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>{{ formatSize(item.downloaded) }} / {{ formatSize(item.size) }}</span>
                <span>{{ progressPercent(item) }}%</span>
              </div>
            </div>

            <!-- Completed info -->
            <div v-else-if="item.status === 'completed'" class="flex items-center gap-2 mt-1">
              <span class="text-xs text-muted-foreground">{{ formatSize(item.size) }}</span>
              <div class="flex items-center gap-1">
                <button
                  class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                  :title="t('downloads.open_file')"
                  @click="openFile(item)"
                >
                  <FileText :size="12" />
                </button>
                <button
                  class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                  :title="t('downloads.open_folder')"
                  @click="openFolder(item)"
                >
                  <FolderOpen :size="12" />
                </button>
              </div>
            </div>

            <!-- Failed info -->
            <div v-else-if="item.status === 'failed'" class="mt-1">
              <span class="text-xs text-destructive">{{ item.error || t('downloads.failed') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

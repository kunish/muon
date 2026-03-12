<script setup lang="ts">
import { getClient } from '@matrix/client'
import { Download, FileText, Film, Image, Music, Search } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { downloadMediaFile } from '@/shared/lib/download'
import { useChatStore } from '../stores/chatStore'

const { t, locale } = useI18n()
const store = useChatStore()
const searchQuery = ref('')

interface FileItem {
  eventId: string
  name: string
  size: number
  mimetype: string
  msgtype: string
  sender: string
  timestamp: number
  url: string
}

const files = computed<FileItem[]>(() => {
  const client = getClient()
  const roomId = store.currentRoomId
  if (!roomId)
    return []

  const room = client.getRoom(roomId)
  if (!room)
    return []

  const timeline = room.getLiveTimeline().getEvents()
  const result: FileItem[] = []

  for (const ev of timeline) {
    if (ev.getType() !== 'm.room.message')
      continue
    const content = ev.getContent()
    const msgtype = content?.msgtype as string | undefined
    if (!msgtype || !['m.file', 'm.image', 'm.video', 'm.audio'].includes(msgtype))
      continue

    result.push({
      eventId: ev.getId() || '',
      name: content.body || t('chat.unknown_file'),
      size: content.info?.size || 0,
      mimetype: content.info?.mimetype || '',
      msgtype,
      sender: ev.getSender() || '',
      timestamp: ev.getTs(),
      url: content.url || '',
    })
  }

  return result.sort((a, b) => b.timestamp - a.timestamp)
})

const filteredFiles = computed(() => {
  if (!searchQuery.value.trim())
    return files.value
  const q = searchQuery.value.toLowerCase()
  return files.value.filter(f => f.name.toLowerCase().includes(q))
})

function formatSize(bytes: number) {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString(locale.value, { month: 'short', day: 'numeric' })
}

function getFileIcon(msgtype: string) {
  switch (msgtype) {
    case 'm.image': return Image
    case 'm.video': return Film
    case 'm.audio': return Music
    default: return FileText
  }
}

function getFileIconClass(msgtype: string) {
  switch (msgtype) {
    case 'm.image': return 'text-success bg-success/5'
    case 'm.video': return 'text-destructive/70 bg-destructive/5'
    case 'm.audio': return 'text-secondary bg-secondary/5'
    default: return 'text-primary bg-primary/5'
  }
}

function getSenderName(userId: string) {
  const client = getClient()
  const user = client.getUser(userId)
  return user?.displayName || userId.split(':')[0]?.slice(1) || userId
}

async function downloadFile(file: FileItem) {
  if (!file.url)
    return
  try {
    await downloadMediaFile(file.url, file.name)
  }
  catch {
    /* download failure is shown via browser UI */
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full min-h-0">
    <!-- Search bar -->
    <div class="px-4 py-3 border-b border-border/40 shrink-0">
      <div class="relative">
        <Search
          class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40"
          :size="13"
        />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('chat.search_files')"
          class="w-full h-[30px] pl-7.5 pr-3 text-[12px] rounded-lg bg-accent/40 border border-transparent outline-none placeholder:text-muted-foreground/35 focus:bg-accent/70 focus:border-ring/20"
        >
      </div>
    </div>

    <!-- File list -->
    <div class="flex-1 overflow-y-auto px-3 py-2">
      <div
        v-for="file in filteredFiles"
        :key="file.eventId"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/40 transition-colors group"
      >
        <!-- File icon -->
        <div
          class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          :class="getFileIconClass(file.msgtype)"
        >
          <component :is="getFileIcon(file.msgtype)" :size="18" />
        </div>

        <!-- File info -->
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">
            {{ file.name }}
          </div>
          <div class="text-[11px] text-muted-foreground/60 mt-0.5">
            {{ getSenderName(file.sender) }} · {{ formatSize(file.size) }} · {{ formatDate(file.timestamp) }}
          </div>
        </div>

        <!-- Download button -->
        <button
          class="p-1.5 rounded-md text-muted-foreground/40 hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all"
          :title="t('chat.download')"
          @click="downloadFile(file)"
        >
          <Download :size="14" />
        </button>
      </div>

      <!-- Empty state -->
      <div
        v-if="filteredFiles.length === 0"
        class="flex flex-col items-center justify-center py-16 text-muted-foreground/50"
      >
        <div class="w-16 h-16 rounded-2xl bg-accent/50 flex items-center justify-center mb-4">
          <FileText :size="28" class="opacity-40" />
        </div>
        <span class="text-sm font-medium">{{ searchQuery ? t('chat.no_matching_files') : t('chat.no_shared_files') }}</span>
        <span class="text-xs mt-1 text-muted-foreground/30">{{ t('chat.no_shared_files_hint') }}</span>
      </div>
    </div>
  </div>
</template>

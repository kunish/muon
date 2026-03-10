<script setup lang="ts">
import { getClient } from '@matrix/client'
import { downloadMedia } from '@matrix/index'
import { Download, FileText, Search } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChatStore } from '../stores/chatStore'

const { t, locale } = useI18n()
const store = useChatStore()
const searchQuery = ref('')

const DOC_EXTENSIONS = new Set([
  'doc',
  'docx',
  'pdf',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'txt',
  'rtf',
  'odt',
  'ods',
  'odp',
  'csv',
  'md',
])

interface DocItem {
  eventId: string
  name: string
  size: number
  mimetype: string
  sender: string
  timestamp: number
  url: string
  ext: string
}

const docs = computed<DocItem[]>(() => {
  const client = getClient()
  const roomId = store.currentRoomId
  if (!roomId)
    return []

  const room = client.getRoom(roomId)
  if (!room)
    return []

  const timeline = room.getLiveTimeline().getEvents()
  const result: DocItem[] = []

  for (const ev of timeline) {
    if (ev.getType() !== 'm.room.message')
      continue
    const content = ev.getContent()
    if (content?.msgtype !== 'm.file')
      continue

    const name = content.body || ''
    const dot = name.lastIndexOf('.')
    const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''

    if (!DOC_EXTENSIONS.has(ext))
      continue

    result.push({
      eventId: ev.getId() || '',
      name,
      size: content.info?.size || 0,
      mimetype: content.info?.mimetype || '',
      sender: ev.getSender() || '',
      timestamp: ev.getTs(),
      url: content.url || '',
      ext: ext.toUpperCase(),
    })
  }

  return result.sort((a, b) => b.timestamp - a.timestamp)
})

const filteredDocs = computed(() => {
  if (!searchQuery.value.trim())
    return docs.value
  const q = searchQuery.value.toLowerCase()
  return docs.value.filter(d => d.name.toLowerCase().includes(q))
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

function getDocIconColor(ext: string) {
  const colorMap: Record<string, string> = {
    PDF: 'text-destructive bg-destructive/5',
    DOC: 'text-primary bg-primary/5',
    DOCX: 'text-primary bg-primary/5',
    XLS: 'text-success bg-success/5',
    XLSX: 'text-success bg-success/5',
    PPT: 'text-warning bg-warning/5',
    PPTX: 'text-warning bg-warning/5',
  }
  return colorMap[ext] || 'text-primary bg-primary/5'
}

function getSenderName(userId: string) {
  const client = getClient()
  const user = client.getUser(userId)
  return user?.displayName || userId.split(':')[0]?.slice(1) || userId
}

async function downloadDoc(doc: DocItem) {
  if (!doc.url)
    return
  try {
    const blob = await downloadMedia(doc.url)
    const a = document.createElement('a')
    const blobUrl = URL.createObjectURL(blob)
    a.href = blobUrl
    a.download = doc.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  }
  catch {
    // silently fail
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
          :placeholder="t('chat.search_docs')"
          class="w-full h-[30px] pl-7.5 pr-3 text-[12px] rounded-lg bg-accent/40 border border-transparent outline-none placeholder:text-muted-foreground/35 focus:bg-accent/70 focus:border-ring/20"
        >
      </div>
    </div>

    <!-- Doc list -->
    <div class="flex-1 overflow-y-auto px-3 py-2">
      <div
        v-for="doc in filteredDocs"
        :key="doc.eventId"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/40 transition-colors group"
      >
        <!-- Doc icon -->
        <div
          class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          :class="getDocIconColor(doc.ext)"
        >
          <FileText :size="18" />
        </div>

        <!-- Doc info -->
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">
            {{ doc.name }}
          </div>
          <div class="text-[11px] text-muted-foreground/60 mt-0.5">
            {{ getSenderName(doc.sender) }} · {{ formatSize(doc.size) }} · {{ formatDate(doc.timestamp) }}
          </div>
        </div>

        <!-- Doc type badge -->
        <span class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent text-muted-foreground/70 shrink-0">
          {{ doc.ext }}
        </span>

        <!-- Download button -->
        <button
          class="p-1.5 rounded-md text-muted-foreground/40 hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all"
          :title="t('chat.download')"
          @click="downloadDoc(doc)"
        >
          <Download :size="14" />
        </button>
      </div>

      <!-- Empty state -->
      <div
        v-if="filteredDocs.length === 0"
        class="flex flex-col items-center justify-center py-16 text-muted-foreground/50"
      >
        <div class="w-16 h-16 rounded-2xl bg-accent/50 flex items-center justify-center mb-4">
          <FileText :size="28" class="opacity-40" />
        </div>
        <span class="text-sm font-medium">{{ searchQuery ? t('chat.no_matching_docs') : t('chat.no_docs') }}</span>
        <span class="text-xs mt-1 text-muted-foreground/30">{{ t('chat.no_docs_hint') }}</span>
      </div>
    </div>
  </div>
</template>

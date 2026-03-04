<script setup lang="ts">
import { getClient } from '@matrix/client'
import { getTimeline, matrixEvents } from '@matrix/index'
import { MessageSquareText, X } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChatStore } from '../stores/chatStore'

interface ThreadItem {
  rootId: string
  rootBody: string
  rootSender: string
  replyCount: number
  lastReplyTs: number
}

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()
const store = useChatStore()
const version = ref(0)

function bump() {
  version.value += 1
}

onMounted(() => {
  matrixEvents.on('room.message', bump)
  matrixEvents.on('room.receipt', bump)
})

onUnmounted(() => {
  matrixEvents.off('room.message', bump)
  matrixEvents.off('room.receipt', bump)
})

const threadItems = computed<ThreadItem[]>(() => {
  void version.value
  const room = getClient().getRoom(props.roomId)
  if (!room)
    return []

  const timeline = getTimeline(props.roomId)
  const threadMeta = new Map<string, { replyCount: number, lastReplyTs: number }>()

  for (const ev of timeline) {
    const rel = ev.getContent()?.['m.relates_to']
    if (rel?.rel_type !== 'm.thread' || !rel?.event_id)
      continue

    const rootId = rel.event_id as string
    const ts = ev.getTs() || 0
    const prev = threadMeta.get(rootId)
    if (prev) {
      prev.replyCount += 1
      if (ts > prev.lastReplyTs)
        prev.lastReplyTs = ts
    }
    else {
      threadMeta.set(rootId, { replyCount: 1, lastReplyTs: ts })
    }
  }

  const items: ThreadItem[] = []
  for (const [rootId, meta] of threadMeta) {
    const root = room.findEventById(rootId)
    if (!root)
      continue

    const senderId = root.getSender() || ''
    const sender = room.getMember(senderId)
    const rootBody = root.getContent()?.body || t('chat.thread')

    items.push({
      rootId,
      rootBody,
      rootSender: sender?.name || senderId,
      replyCount: meta.replyCount,
      lastReplyTs: meta.lastReplyTs,
    })
  }

  return items.sort((a, b) => b.lastReplyTs - a.lastReplyTs)
})

function openThread(rootId: string) {
  store.openThread(rootId)
  store.closeSidePanel()
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const isToday = d.getDate() === today.getDate()
    && d.getMonth() === today.getMonth()
    && d.getFullYear() === today.getFullYear()
  if (isToday) {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="flex h-full flex-col bg-background">
    <div class="flex h-12 items-center justify-between border-b border-border px-4">
      <div class="flex items-center gap-2 text-sm font-semibold">
        <MessageSquareText :size="16" />
        {{ t('chat.thread_inbox') }}
      </div>
      <button
        class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        :title="t('common.close')"
        @click="store.closeSidePanel()"
      >
        <X :size="16" />
      </button>
    </div>

    <div v-if="threadItems.length === 0" class="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
      <MessageSquareText :size="28" class="opacity-40" />
      <span class="text-sm">{{ t('chat.thread_inbox_empty') }}</span>
    </div>

    <div v-else class="flex-1 space-y-1 overflow-y-auto p-2">
      <button
        v-for="item in threadItems"
        :key="item.rootId"
        class="w-full rounded-md border border-transparent bg-muted/20 px-3 py-2 text-left transition-colors hover:border-border hover:bg-accent/40"
        @click="openThread(item.rootId)"
      >
        <div class="mb-0.5 flex items-center gap-2">
          <span class="truncate text-xs font-medium text-foreground">{{ item.rootSender }}</span>
          <span class="text-[10px] text-muted-foreground">{{ formatTime(item.lastReplyTs) }}</span>
          <span class="ml-auto text-[10px] text-muted-foreground">{{ item.replyCount }}</span>
        </div>
        <p class="line-clamp-2 text-xs text-muted-foreground">
          {{ item.rootBody }}
        </p>
      </button>
    </div>
  </div>
</template>

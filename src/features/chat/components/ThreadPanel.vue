<script setup lang="ts">
import { getClient } from '@matrix/client'
import { getThreadReplies, sendThreadReply } from '@matrix/index'
import { format } from 'date-fns'
import { MessageSquare, Send, X } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChatStore } from '../stores/chatStore'

const props = defineProps<{
  roomId: string
  threadRootId: string
}>()

const store = useChatStore()
const { t } = useI18n()
const replyText = ref('')
const sending = ref(false)
const listRef = ref<HTMLElement | null>(null)

const client = getClient()

// --- Thread root event ---
const rootEvent = computed(() => {
  const room = client.getRoom(props.roomId)
  return room?.findEventById(props.threadRootId) || null
})

const rootBody = computed(() => rootEvent.value?.getContent()?.body || '')
const rootSender = computed(() => {
  if (!rootEvent.value)
    return ''
  const room = client.getRoom(props.roomId)
  const member = room?.getMember(rootEvent.value.getSender()!)
  return member?.name || rootEvent.value.getSender() || ''
})
const rootTime = computed(() => {
  if (!rootEvent.value)
    return ''
  return format(rootEvent.value.getTs(), 'MM/dd HH:mm')
})

// --- Thread replies ---
const replies = computed(() => getThreadReplies(props.roomId, props.threadRootId))

function getSenderName(event: any): string {
  const room = client.getRoom(props.roomId)
  const member = room?.getMember(event.getSender()!)
  return member?.name || event.getSender() || ''
}

function getTime(event: any): string {
  return format(event.getTs(), 'HH:mm')
}

// --- Send reply ---
async function onSend() {
  const text = replyText.value.trim()
  if (!text || sending.value)
    return
  sending.value = true
  try {
    await sendThreadReply(props.roomId, props.threadRootId, text)
    replyText.value = ''
    await nextTick()
    listRef.value?.scrollTo({ top: listRef.value.scrollHeight, behavior: 'smooth' })
  }
  catch (err) {
    console.error('Thread reply failed:', err)
  }
  finally {
    sending.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onSend()
  }
}

// Auto scroll on new replies
watch(replies, async () => {
  await nextTick()
  listRef.value?.scrollTo({ top: listRef.value.scrollHeight, behavior: 'smooth' })
})
</script>

<template>
  <div class="w-[360px] shrink-0 bg-background border-l border-border h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-border">
      <div class="flex items-center gap-2 text-sm font-medium">
        <MessageSquare :size="16" />
        {{ t('chat.thread') }}
      </div>
      <button
        class="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        :title="t('common.close')"
        @click="store.closeThread()"
      >
        <X :size="16" />
      </button>
    </div>

    <!-- Thread root message -->
    <div class="px-4 py-3 border-b border-border bg-muted/30">
      <div class="flex items-baseline gap-2 mb-1">
        <span class="text-xs font-medium">{{ rootSender }}</span>
        <span class="text-[10px] text-muted-foreground">{{ rootTime }}</span>
      </div>
      <p class="text-sm text-foreground line-clamp-4 break-words">
        {{ rootBody }}
      </p>
    </div>

    <!-- Replies list -->
    <div ref="listRef" class="flex-1 overflow-y-auto px-4 py-2 space-y-3">
      <div v-if="replies.length === 0" class="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
        <MessageSquare :size="32" class="mb-2 opacity-30" />
        {{ t('chat.thread_no_replies') }}
      </div>
      <div
        v-for="ev in replies"
        :key="ev.getId()"
        class="group"
      >
        <div class="flex items-baseline gap-2 mb-0.5">
          <span class="text-xs font-medium">{{ getSenderName(ev) }}</span>
          <span class="text-[10px] text-muted-foreground">{{ getTime(ev) }}</span>
        </div>
        <div class="text-sm break-words bg-muted rounded-lg px-3 py-1.5">
          {{ ev.getContent()?.body || '' }}
        </div>
      </div>
    </div>

    <!-- Reply input -->
    <div class="border-t border-border px-3 py-2">
      <div class="flex items-end gap-2">
        <textarea
          v-model="replyText"
          :placeholder="t('chat.thread_reply_placeholder')"
          class="flex-1 resize-none rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/30 max-h-24 min-h-[36px]"
          rows="1"
          @keydown="onKeydown"
        />
        <button
          class="shrink-0 p-2 rounded-lg transition-colors cursor-pointer"
          :class="replyText.trim()
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'bg-muted text-muted-foreground'"
          :disabled="!replyText.trim() || sending"
          @click="onSend"
        >
          <Send :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>

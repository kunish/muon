<script setup lang="ts">
import { getClient } from '@matrix/client'
import { ChevronDown } from 'lucide-vue-next'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useMessages } from '../composables/useMessages'
import MessageBubble from './MessageBubble.vue'
import TimeStamp from './TimeStamp.vue'

const { messages, isLoading, hasMore, loadMore } = useMessages()
const containerRef = ref<HTMLElement>()
const isAtBottom = ref(true)
const showNewMsg = ref(false)

const userId = computed(() => getClient().getUserId())

function shouldShowTimestamp(idx: number): boolean {
  if (idx === 0)
    return true
  const prev = messages.value[idx - 1]
  const curr = messages.value[idx]
  return curr.getTs() - prev.getTs() > 5 * 60 * 1000
}

function shouldShowSender(idx: number): boolean {
  if (idx === 0)
    return true
  const prev = messages.value[idx - 1]
  const curr = messages.value[idx]
  return prev.getSender() !== curr.getSender() || shouldShowTimestamp(idx)
}

function scrollToBottom() {
  const el = containerRef.value
  if (!el)
    return
  el.scrollTop = el.scrollHeight
  showNewMsg.value = false
}

function onScroll() {
  const el = containerRef.value
  if (!el)
    return
  isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 50
  if (isAtBottom.value)
    showNewMsg.value = false
  if (el.scrollTop < 100 && hasMore.value && !isLoading.value)
    loadMore()
}

watch(() => messages.value.length, async (newLen, oldLen) => {
  if (newLen > (oldLen || 0)) {
    if (isAtBottom.value) {
      await nextTick()
      scrollToBottom()
    }
    else {
      showNewMsg.value = true
    }
  }
})

onMounted(() => {
  nextTick(() => scrollToBottom())
})
</script>

<template>
  <div
    ref="containerRef"
    class="flex-1 overflow-y-auto py-2 relative"
    @scroll="onScroll"
  >
    <div v-if="isLoading" class="text-center py-2">
      <span class="text-xs text-muted-foreground">加载中...</span>
    </div>

    <template v-for="(event, idx) in messages" :key="event.getId()">
      <TimeStamp
        v-if="shouldShowTimestamp(idx)"
        :timestamp="event.getTs()"
      />
      <MessageBubble
        :event="event"
        :is-mine="event.getSender() === userId"
        :show-sender="shouldShowSender(idx)"
      />
    </template>

    <!-- New message indicator -->
    <button
      v-if="showNewMsg"
      class="sticky bottom-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-md flex items-center gap-1"
      @click="scrollToBottom"
    >
      <ChevronDown :size="14" />
      新消息
    </button>
  </div>
</template>

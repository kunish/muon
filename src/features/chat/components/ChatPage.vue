<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { useChatStore } from '../stores/chatStore'
import ChatWindow from './ChatWindow.vue'
import ConversationList from './ConversationList.vue'
import EmptyState from './EmptyState.vue'

const route = useRoute()
const store = useChatStore()

watch(
  () => route.params.roomId as string | undefined,
  (roomId) => {
    store.setCurrentRoom(roomId || null)
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex-1 flex h-full min-w-0">
    <div class="w-[280px] border-r border-border shrink-0">
      <ConversationList />
    </div>
    <ChatWindow v-if="store.currentRoomId" />
    <EmptyState v-else />
  </div>
</template>

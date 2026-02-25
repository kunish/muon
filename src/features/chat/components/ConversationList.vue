<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useConversations } from '../composables/useConversations'
import { useChatStore } from '../stores/chatStore'
import ConversationItem from './ConversationItem.vue'

const router = useRouter()
const store = useChatStore()
const { conversations } = useConversations()

function selectRoom(roomId: string) {
  store.setCurrentRoom(roomId)
  router.push(`/chat/${roomId}`)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="p-3">
      <div class="relative">
        <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" :size="14" />
        <input
          :value="store.searchQuery"
          type="text"
          placeholder="搜索会话..."
          class="w-full h-8 pl-8 pr-3 text-sm rounded-md bg-muted border-none outline-none placeholder:text-muted-foreground"
          @input="store.setSearchQuery(($event.target as HTMLInputElement).value)"
        >
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-1.5">
      <ConversationItem
        v-for="room in conversations"
        :key="room.roomId"
        :room="room"
        :active="room.roomId === store.currentRoomId"
        @select="selectRoom"
      />
      <div
        v-if="conversations.length === 0"
        class="text-center text-sm text-muted-foreground py-8"
      >
        暂无会话
      </div>
    </div>
  </div>
</template>

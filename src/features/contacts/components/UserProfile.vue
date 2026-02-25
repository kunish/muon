<script setup lang="ts">
import { MessageSquare, Phone, Video } from 'lucide-vue-next'
import { computed } from 'vue'
import { useContactStore } from '../stores/contactStore'

const emit = defineEmits<{
  message: [userId: string]
  audioCall: [userId: string]
  videoCall: [userId: string]
}>()

const store = useContactStore()

const contact = computed(() =>
  store.contacts.find(c => c.userId === store.selectedContactId),
)
</script>

<template>
  <div v-if="contact" class="flex flex-col items-center p-6">
    <div class="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-medium mb-3">
      {{ contact.displayName.slice(0, 1) }}
    </div>
    <h3 class="font-medium text-lg">
      {{ contact.displayName }}
    </h3>
    <p class="text-sm text-muted-foreground mb-1">
      {{ contact.userId }}
    </p>
    <div
      class="flex items-center gap-1 text-xs mb-6"
      :class="contact.presence === 'online' ? 'text-green-500' : 'text-muted-foreground'"
    >
      <div
        class="w-2 h-2 rounded-full"
        :class="contact.presence === 'online' ? 'bg-green-500' : 'bg-muted-foreground/30'"
      />
      {{ contact.presence === 'online' ? '在线' : '离线' }}
    </div>

    <div class="flex items-center gap-3">
      <button
        class="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-accent"
        @click="emit('message', contact!.userId)"
      >
        <MessageSquare :size="20" class="text-primary" />
        <span class="text-xs">消息</span>
      </button>
      <button
        class="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-accent"
        @click="emit('audioCall', contact!.userId)"
      >
        <Phone :size="20" class="text-primary" />
        <span class="text-xs">语音</span>
      </button>
      <button
        class="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-accent"
        @click="emit('videoCall', contact!.userId)"
      >
        <Video :size="20" class="text-primary" />
        <span class="text-xs">视频</span>
      </button>
    </div>
  </div>

  <div v-else class="flex-1 flex items-center justify-center text-muted-foreground text-sm">
    选择一个联系人查看资料
  </div>
</template>

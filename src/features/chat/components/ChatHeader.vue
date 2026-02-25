<script setup lang="ts">
import { Hash, Lock, MoreVertical, Users } from 'lucide-vue-next'
import { computed } from 'vue'
import { useCurrentRoom } from '../composables/useCurrentRoom'

const { room } = useCurrentRoom()

const memberCount = computed(() => {
  if (!room.value)
    return 0
  return room.value.getJoinedMemberCount()
})

const isEncrypted = computed(() => {
  if (!room.value)
    return false
  return room.value.hasEncryptionStateEvent()
})
</script>

<template>
  <div v-if="room" class="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
    <div class="flex items-center gap-3 min-w-0">
      <Hash v-if="!isEncrypted" :size="18" class="text-muted-foreground shrink-0" />
      <Lock v-else :size="18" class="text-green-500 shrink-0" />
      <span class="font-medium truncate">{{ room.name }}</span>
    </div>

    <div class="flex items-center gap-2">
      <div class="flex items-center gap-1 text-xs text-muted-foreground">
        <Users :size="14" />
        <span>{{ memberCount }}</span>
      </div>
      <button class="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
        <MoreVertical :size="16" />
      </button>
    </div>
  </div>
</template>

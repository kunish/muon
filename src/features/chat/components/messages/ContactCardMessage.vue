<script setup lang="ts">
import { UserCircle } from 'lucide-vue-next'
import Avatar from '@/shared/components/ui/avatar.vue'

defineProps<{
  userId: string
  displayName: string
  avatarUrl?: string
}>()

const emit = defineEmits<{
  openProfile: [userId: string, event: MouseEvent]
}>()
</script>

<template>
  <div
    class="flex items-center gap-3 p-3 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer min-w-[220px] max-w-[300px]"
    @click="emit('openProfile', userId, $event)"
  >
    <Avatar
      :src="avatarUrl"
      :alt="displayName"
      :color-id="userId"
      size="md"
      shape="circle"
    />
    <div class="flex-1 min-w-0">
      <div class="text-sm font-medium truncate">
        {{ displayName }}
      </div>
      <div class="text-[11px] text-muted-foreground truncate">
        {{ userId }}
      </div>
    </div>
    <UserCircle :size="16" class="text-muted-foreground/50 shrink-0" />
  </div>
</template>

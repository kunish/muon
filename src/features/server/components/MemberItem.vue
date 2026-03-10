<script setup lang="ts">
import type { SpaceMember } from '@/matrix/spaces'
import { computed } from 'vue'
import { getUserPresenceInfo } from '@/matrix/profile'
import { Avatar } from '@/shared/components/ui/avatar'

const props = defineProps<{
  member: SpaceMember
  roleColor: string
}>()

const emit = defineEmits<{
  click: [event: MouseEvent]
  contextmenu: [event: MouseEvent]
}>()

// 在线状态
const presence = computed(() => getUserPresenceInfo(props.member.userId))

const presenceValue = computed(() => {
  const p = presence.value.presence
  if (p === 'online' || p === 'unavailable' || p === 'busy')
    return p as 'online' | 'unavailable' | 'busy'
  return 'offline' as const
})

const isOffline = computed(() =>
  presenceValue.value === 'offline',
)
</script>

<template>
  <div
    class="flex items-center gap-2.5 px-2 py-1 rounded-md cursor-pointer transition-colors duration-100 hover:bg-accent/50 group"
    :class="{ 'opacity-50': isOffline }"
    @click="emit('click', $event)"
    @contextmenu.prevent="emit('contextmenu', $event)"
  >
    <!-- 头像 + 状态指示器 -->
    <Avatar
      :src="member.avatarUrl"
      :alt="member.displayName"
      :color-id="member.userId"
      :presence="presenceValue"
      size="sm"
    />

    <!-- 名称 -->
    <span
      class="text-sm truncate leading-tight"
      :style="{ color: roleColor }"
    >
      {{ member.displayName }}
    </span>
  </div>
</template>

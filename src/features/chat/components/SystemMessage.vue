<script setup lang="ts">
import type { SystemEventInfo } from '@matrix/messages'
import type { MatrixEvent } from 'matrix-js-sdk'
import { getSystemEventInfo } from '@matrix/index'
import {
  Ban,
  HelpCircle,
  ImageIcon,
  ImagePlus,
  LogIn,
  LogOut,
  MessageSquareText,
  PenLine,
  Plus,
  Type,
  UserMinus,
  UserPlus,
} from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps<{
  event: MatrixEvent
}>()

const emit = defineEmits<{
  userClick: [userId: string, event: MouseEvent]
}>()

const info = computed<SystemEventInfo>(() => getSystemEventInfo(props.event))

const ICON_MAP: Record<string, any> = {
  join: LogIn,
  leave: LogOut,
  kick: UserMinus,
  ban: Ban,
  invite: UserPlus,
  rename: PenLine,
  avatar: ImageIcon,
  room_name: Type,
  room_topic: MessageSquareText,
  room_avatar: ImagePlus,
  room_create: Plus,
  unknown: HelpCircle,
}

const icon = computed(() => ICON_MAP[info.value.kind] || HelpCircle)

function onUserClick(userId: string | undefined, e: MouseEvent) {
  if (userId) {
    emit('userClick', userId, e)
  }
}
</script>

<template>
  <div class="flex items-center justify-center py-0.5 px-4 select-none">
    <div
      class="sys-msg inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/55 bg-accent/40 px-3 py-1 rounded-lg max-w-[80%]"
    >
      <!-- 事件图标 -->
      <component
        :is="icon"
        :size="12"
        class="shrink-0 opacity-60"
      />

      <!-- 结构化片段渲染 -->
      <span class="inline leading-relaxed">
        <template v-for="(part, idx) in info.parts" :key="idx">
          <!-- 可点击的用户名 -->
          <span
            v-if="part.type === 'user'"
            class="sys-user font-semibold text-foreground/70 cursor-pointer hover:text-primary hover:underline underline-offset-2 transition-colors duration-150"
            @click.stop="onUserClick(part.userId, $event)"
          >{{ part.text }}</span>
          <!-- 高亮文本（群名/话题等） -->
          <span
            v-else-if="part.type === 'highlight'"
            class="font-medium text-foreground/60"
          >{{ part.text }}</span>
          <!-- 普通文本 -->
          <span v-else>{{ part.text }}</span>
        </template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.sys-msg {
  animation: sys-fade-in 0.3s ease both;
}

@keyframes sys-fade-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

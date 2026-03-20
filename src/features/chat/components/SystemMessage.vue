<script setup lang="ts">
import type { SystemEventInfo } from '@matrix/messages'
/**
 * 系统事件消息（入群、退群、改名等）
 * 居中、淡色文字、箭头图标前缀
 */
import type { MatrixEvent } from 'matrix-js-sdk'
import { getSystemEventInfo } from '@matrix/index'
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  HelpCircle,
  ImageIcon,
  ImagePlus,
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
  join: ArrowRight,
  leave: ArrowLeft,
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

const timestamp = computed(() => {
  const ts = props.event.getTs()
  if (!ts)
    return ''
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
})

function onUserClick(userId: string | undefined, e: MouseEvent) {
  if (userId) {
    emit('userClick', userId, e)
  }
}
</script>

<template>
  <div class="flex items-center py-0.5 px-4 pl-14 min-h-[1.375rem] hover:bg-background/[0.06] group animate-sys-fade-in">
    <!-- 图标列 -->
    <component
      :is="icon"
      :size="14"
      class="shrink-0 text-muted-foreground/40 mr-2"
    />

    <!-- 结构化片段渲染 -->
    <span class="text-[13px] text-muted-foreground/60 leading-snug">
      <template v-for="(part, idx) in info.parts" :key="idx">
        <!-- 可点击的用户名 -->
        <span
          v-if="part.type === 'user'"
          class="font-medium text-muted-foreground/80 cursor-pointer hover:text-foreground hover:underline underline-offset-2 transition-colors"
          @click.stop="onUserClick(part.userId, $event)"
        >{{ part.text }}</span>
        <!-- 高亮文本（群名/话题等） -->
        <span
          v-else-if="part.type === 'highlight'"
          class="font-medium text-foreground/70"
        >{{ part.text }}</span>
        <!-- 普通文本 -->
        <span v-else>{{ part.text }}</span>
      </template>
    </span>

    <!-- 时间戳 -->
    <span class="ml-2 text-[11px] text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
      {{ timestamp }}
    </span>
  </div>
</template>

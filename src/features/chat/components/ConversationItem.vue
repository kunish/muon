<script setup lang="ts">
import type { RoomSummary } from '@matrix/types'
import { BellOff, FileText, Film, Image, Lock, Mic, Pin } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Avatar from '@/shared/components/ui/avatar.vue'
import {
  formatMessageTime,
  messageTypeLabel as getTypeLabel,
  isLikelyBot,
} from '../lib/format'
import { useChatStore } from '../stores/chatStore'

const props = defineProps<{
  room: RoomSummary
  active: boolean
  typingUsers?: string[]
}>()

defineEmits<{
  select: [roomId: string]
  avatarClick: [room: RoomSummary, event: MouseEvent]
  contextmenu: [roomId: string, event: MouseEvent]
}>()

const store = useChatStore()
const { t } = useI18n()
const pinned = computed(() => store.isPinned(props.room.roomId))
const muted = computed(() => store.isMuted(props.room.roomId))
const markedUnread = computed(() => store.isMarkedUnread(props.room.roomId))
const draft = computed(() => store.getDraft(props.room.roomId))

const timeLabel = computed(() => formatMessageTime(props.room.lastMessageTs))
const mxcAvatar = computed(() => props.room.avatar || props.room.dmUserAvatar)
const isBot = computed(() => props.room.isDirect && !!props.room.dmUserId && isLikelyBot(props.room.dmUserId))

/** 飞书风格：是否有 @提及（highlightCount > 0 表示有人 @ 了你） */
const hasHighlight = computed(() => props.room.highlightCount > 0)

/** 群聊成员数（仅群聊显示） */
const groupMemberCount = computed(() => {
  if (props.room.isDirect)
    return 0
  return props.room.memberCount || props.room.members.length
})

const MESSAGE_TYPE_ICONS: Record<string, any> = {
  'm.image': Image,
  'm.video': Film,
  'm.audio': Mic,
  'm.file': FileText,
}

const typeIcon = computed(() => {
  const t = props.room.lastMessageType
  return t ? (MESSAGE_TYPE_ICONS[t] ?? null) : null
})

const typeLabel = computed(() => {
  const key = getTypeLabel(props.room.lastMessageType)
  return key ? t(key) : null
})

const preview = computed(() => {
  if (!props.room.lastMessage)
    return t('chat.no_messages')
  if (typeLabel.value)
    return `[${typeLabel.value}]`
  return props.room.lastMessage
})

const sender = computed(() => {
  if (props.room.isDirect || !props.room.lastMessageSender)
    return ''
  return props.room.lastMessageSender
})
</script>

<template>
  <div
    class="conv-item group flex items-center gap-3 px-2.5 py-[9px] cursor-pointer rounded-xl relative select-none"
    :class="[
      active
        ? 'conv-active bg-accent/90 shadow-[0_1px_6px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]'
        : pinned
          ? 'conv-pinned bg-accent/30 hover:bg-accent/60'
          : 'hover:bg-accent/50 hover:shadow-[0_1px_4px_rgba(0,0,0,0.02)]',
    ]"
    @click="$emit('select', room.roomId)"
    @contextmenu.prevent="$emit('contextmenu', room.roomId, $event)"
  >
    <!-- 未读指示条 - 带脉冲动画 -->
    <span
      v-if="room.unreadCount > 0 && !active"
      class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary/80"
      style="animation: conv-unread-ping 2.5s ease-in-out infinite"
    />

    <!-- 头像 - 增强悬停效果 -->
    <div
      class="relative shrink-0 conv-avatar-wrap"
      @click.stop="$emit('avatarClick', room, $event)"
    >
      <Avatar
        :src="mxcAvatar"
        :alt="room.name"
        :color-id="room.roomId"
        size="md"
        shape="circle"
        :clickable="true"
      />
      <!-- 加密徽标 -->
      <div
        v-if="room.isEncrypted"
        class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center ring-[1.5px] ring-sidebar shadow-[0_1px_3px_rgba(16,185,129,0.3)]"
      >
        <Lock :size="7" class="text-white" />
      </div>
    </div>

    <!-- 内容区 -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-2">
        <span
          class="text-[13px] font-semibold truncate leading-tight transition-colors duration-150"
          :class="room.unreadCount > 0 || markedUnread ? 'text-foreground' : 'text-foreground/80 group-hover:text-foreground/95'"
        >
          {{ room.name }}
          <span
            v-if="isBot"
            class="inline-flex items-center ml-1 px-1 py-px text-[9px] font-bold leading-none rounded bg-primary/15 text-primary"
          >{{ t('chat.bot_badge') }}</span>
          <!-- 群聊成员数 -->
          <span
            v-if="groupMemberCount > 0"
            class="inline-flex items-center ml-1 text-[10px] text-muted-foreground/45 font-normal"
          >({{ groupMemberCount }})</span>
        </span>
        <div class="flex items-center gap-1 shrink-0">
          <Pin v-if="pinned" :size="10" class="text-primary/60" />
          <BellOff v-if="muted" :size="10" class="text-muted-foreground/40" />
          <span
            class="text-[10px] tabular-nums tracking-tight transition-colors duration-150"
            :class="room.unreadCount > 0 ? 'text-primary font-semibold' : 'text-muted-foreground/50 group-hover:text-muted-foreground/70'"
          >
            {{ timeLabel }}
          </span>
        </div>
      </div>

      <div class="flex items-center justify-between gap-2 mt-[3px]">
        <div
          class="flex items-center gap-1 min-w-0 text-[11.5px] leading-tight transition-colors duration-150"
          :class="room.unreadCount > 0 || markedUnread ? 'text-muted-foreground/90' : 'text-muted-foreground/55 group-hover:text-muted-foreground/70'"
        >
          <!-- 正在输入 > 草稿 > 正常预览 -->
          <template v-if="typingUsers && typingUsers.length > 0">
            <span class="text-primary/70 font-medium flex items-center gap-1">
              {{ t('chat.typing_indicator') }}
              <span class="inline-flex gap-0.5">
                <span class="w-1 h-1 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                <span class="w-1 h-1 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                <span class="w-1 h-1 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
              </span>
            </span>
          </template>
          <!-- 草稿优先显示 -->
          <template v-else-if="draft">
            <span class="shrink-0 text-destructive/70 font-medium">[{{ t('chat.draft') }}]</span>
            <span class="truncate text-destructive/50">{{ draft }}</span>
          </template>
          <template v-else>
            <!-- 飞书风格：@提及标识 -->
            <span
              v-if="hasHighlight"
              class="shrink-0 text-destructive/80 font-semibold"
            >[{{ t('chat.at_mention') }}]</span>
            <component
              :is="typeIcon"
              v-if="typeIcon"
              :size="11"
              class="shrink-0 opacity-50"
            />
            <span v-if="sender" class="shrink-0 max-w-[56px] truncate text-foreground/35">
              {{ sender }}:
            </span>
            <span class="truncate">{{ preview }}</span>
          </template>
        </div>

        <!-- 未读徽标 / 标记未读圆点 / 免打扰灰点 -->
        <span
          v-if="room.unreadCount > 0 && !muted"
          class="shrink-0 min-w-[17px] h-[17px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1.5 leading-none shadow-[0_1px_4px_rgba(0,0,0,0.1)]"
          style="animation: conv-badge-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) both"
        >
          {{ room.unreadCount > 99 ? '99+' : room.unreadCount }}
        </span>
        <span
          v-else-if="room.unreadCount > 0 && muted"
          class="shrink-0 w-2 h-2 rounded-full bg-muted-foreground/30"
        />
        <span
          v-else-if="markedUnread"
          class="shrink-0 w-2.5 h-2.5 rounded-full bg-primary/60"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.conv-item {
  transition:
    background-color 0.18s ease,
    box-shadow 0.22s ease,
    transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
  animation: conv-slide-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--conv-index, 0) * 35ms);
}

.conv-item:active {
  transform: scale(0.985);
  transition-duration: 0.08s;
}

.conv-active {
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.conv-active::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.conv-avatar-wrap {
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.conv-item:hover .conv-avatar-wrap {
  transform: scale(1.04);
}
</style>

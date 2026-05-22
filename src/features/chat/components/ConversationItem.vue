<script setup lang="ts">
import type { RoomSummary } from '@matrix/types'
import { Avatar } from '@muon/ui/avatar'
import { BellOff, FileText, Film, Image, Lock, Mic, Pin } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
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
  contextMenuOpen?: boolean
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
const isContextMenuOpen = computed(() => props.contextMenuOpen === true)
const isUnreadOrMarked = computed(() => props.room.unreadCount > 0 || markedUnread.value)
const rowStateClass = computed(() => {
  if (props.active) {
    return 'bg-accent text-foreground'
  }

  if (pinned.value) {
    return isContextMenuOpen.value
      ? 'conv-pinned bg-accent'
      : 'conv-pinned bg-muted hover:bg-accent'
  }

  return isContextMenuOpen.value
    ? 'bg-accent'
    : 'hover:bg-accent'
})
const avatarStateClass = computed(() => isContextMenuOpen.value ? 'scale-[1.04]' : '')
const nameTextClass = computed(() => {
  if (props.active || isUnreadOrMarked.value)
    return 'text-foreground'
  return isContextMenuOpen.value
    ? 'text-foreground/95'
    : 'text-foreground/80 group-hover:text-foreground/95'
})
const timeTextClass = computed(() => {
  if (props.active || props.room.unreadCount > 0)
    return 'text-primary font-semibold'
  return isContextMenuOpen.value
    ? 'text-muted-foreground/70'
    : 'text-muted-foreground/50 group-hover:text-muted-foreground/70'
})
const previewTextClass = computed(() => {
  if (props.active || isUnreadOrMarked.value)
    return 'text-muted-foreground/90'
  return isContextMenuOpen.value
    ? 'text-muted-foreground/70'
    : 'text-muted-foreground/55 group-hover:text-muted-foreground/70'
})

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
  'm.room.encrypted': Lock,
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
  if (typeLabel.value)
    return `[${typeLabel.value}]`
  if (!props.room.lastMessage)
    return t('chat.no_messages')
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
    class="group relative flex min-h-[60px] cursor-pointer select-none items-center gap-2.5 px-4 py-2.5 transition-colors duration-150 active:scale-[0.985] active:duration-75"
    :class="[
      rowStateClass,
    ]"
    :aria-current="active ? 'true' : undefined"
    @click="$emit('select', room.roomId)"
    @contextmenu.prevent="$emit('contextmenu', room.roomId, $event)"
  >
    <span
      v-if="active"
      class="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 bg-primary"
    />

    <!-- 未读指示条 - 带脉冲动画 -->
    <span
      v-if="room.unreadCount > 0 && !active"
      class="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 bg-primary"
      style="animation: indicator-ping 2.5s ease-in-out infinite"
    />

    <!-- 头像 - 增强悬停效果 -->
    <div
      class="relative shrink-0 transition-transform duration-150 group-hover:scale-[1.03]"
      :class="avatarStateClass"
      @click.stop="$emit('avatarClick', room, $event)"
    >
      <Avatar
        :src="mxcAvatar"
        :alt="room.name"
        :color-id="room.roomId"
        size="sm"
        shape="circle"
        class="cursor-pointer"
      />
      <!-- 加密徽标 -->
      <div
        v-if="room.isEncrypted"
        class="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-success ring-[1.5px] ring-sidebar"
      >
        <Lock :size="7" class="text-white" />
      </div>
    </div>

    <!-- 内容区 -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-2">
        <span
          class="truncate text-base font-semibold leading-tight transition-colors duration-150"
          :class="nameTextClass"
        >
          {{ room.name }}
          <span
            v-if="isBot"
            class="ml-1 inline-flex items-center rounded bg-primary/15 px-1 py-px text-[9px] font-bold leading-none text-primary"
          >{{ t('chat.bot_badge') }}</span>
          <!-- 群聊成员数 -->
          <span
            v-if="groupMemberCount > 0"
            class="ml-1 inline-flex items-center text-[10px] font-normal text-muted-foreground"
          >({{ groupMemberCount }})</span>
        </span>
        <div class="flex items-center gap-1 shrink-0">
          <Pin v-if="pinned" :size="10" class="text-primary/60" />
          <BellOff v-if="muted" :size="10" class="text-muted-foreground/40" />
          <span
            class="text-[10px] tabular-nums tracking-tight transition-colors duration-150"
            :class="timeTextClass"
          >
            {{ timeLabel }}
          </span>
        </div>
      </div>

      <div class="mt-[3px] flex items-center justify-between gap-2">
        <div
          class="flex min-w-0 items-center gap-1 text-[12px] leading-tight transition-colors duration-150"
          :class="previewTextClass"
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
          class="flex h-[17px] min-w-[17px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-none text-primary-foreground"
          style="animation: badge-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) both"
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

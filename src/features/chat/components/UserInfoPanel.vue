<script setup lang="ts">
import type { RoomSummary } from '@matrix/types'
import { getClient } from '@matrix/client'
import { blockUser, getUserPresenceInfo, isUserBlocked, unblockUser } from '@matrix/index'
import { findOrCreateDm, getRoom } from '@matrix/rooms'
import { ask } from '@tauri-apps/plugin-dialog'
import { AtSign, Ban, Hash, MessageCircle, Shield, X } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthMedia } from '@/shared/composables/useAuthMedia'
import { useConversations } from '../composables/useConversations'
import {
  avatarGradient as getGradient,
  initials as getInitials,
} from '../lib/format'
import { useChatStore } from '../stores/chatStore'

const props = defineProps<{
  room: RoomSummary | null
  /** 消息列表模式：直接传 userId + roomId */
  userId?: string | null
  roomId?: string | null
  position: { x: number, y: number }
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

const memberInfo = ref<{
  displayName: string
  avatarUrl?: string
  userId: string
  presence?: string
} | null>(null)

const isVisible = computed(() => !!(props.room || props.userId))

// 模式1: 通过 room (会话列表)
watch(() => props.room, (room) => {
  if (props.userId)
    return // userId 模式优先
  if (!room) {
    memberInfo.value = null
    return
  }
  const matrixRoom = getRoom(room.roomId)
  if (!matrixRoom)
    return

  if (room.isDirect && room.dmUserId) {
    const member = matrixRoom.getMember(room.dmUserId)
    memberInfo.value = {
      displayName: member?.name || room.dmUserId.split(':')[0].slice(1),
      avatarUrl: member?.getMxcAvatarUrl() || undefined,
      userId: room.dmUserId,
    }
  }
  else {
    memberInfo.value = {
      displayName: room.name,
      avatarUrl: room.avatar,
      userId: room.roomId,
    }
  }
}, { immediate: true })

// 模式2: 通过 userId (消息列表头像点击)
watch(() => props.userId, (uid) => {
  if (!uid) {
    if (!props.room)
      memberInfo.value = null
    return
  }
  const rid = props.roomId || props.room?.roomId
  if (!rid)
    return
  const matrixRoom = getRoom(rid)
  if (!matrixRoom)
    return
  const member = matrixRoom.getMember(uid)
  memberInfo.value = {
    displayName: member?.name || uid.split(':')[0].slice(1),
    avatarUrl: member?.getMxcAvatarUrl() || undefined,
    userId: uid,
  }
}, { immediate: true })

const resolvedAvatar = useAuthMedia(() => memberInfo.value?.avatarUrl, 80, 80)

const gradient = computed(() => {
  const seed = props.userId || props.room?.roomId || ''

  return getGradient(seed)
})
const letter = computed(() => getInitials(memberInfo.value?.displayName || '?'))

const userStatusMsg = computed(() => {
  if (!memberInfo.value?.userId || !memberInfo.value.userId.startsWith('@'))
    return ''
  return getUserPresenceInfo(memberInfo.value.userId).statusMsg || ''
})

const resolvedRoomId = computed(() => props.roomId || props.room?.roomId)

const memberCount = computed(() => {
  if (!resolvedRoomId.value)
    return 0
  const matrixRoom = getRoom(resolvedRoomId.value)
  return matrixRoom?.getJoinedMemberCount() || 0
})

const panelStyle = computed(() => {
  if (!isVisible.value)
    return { display: 'none' }
  const panelW = 272
  const panelH = 320
  const margin = 8
  let x = props.position.x + margin
  let y = props.position.y

  // 右侧溢出 → 改为显示在点击位置左侧
  if (x + panelW > window.innerWidth - margin) {
    x = props.position.x - panelW - margin
  }
  // 左侧溢出兜底
  if (x < margin)
    x = margin
  // 底部溢出
  if (y + panelH > window.innerHeight - margin) {
    y = window.innerHeight - panelH - margin
  }
  // 顶部溢出
  if (y < margin)
    y = margin

  return {
    position: 'fixed' as const,
    left: `${x}px`,
    top: `${y}px`,
    zIndex: 100,
  }
})

const chatStore = useChatStore()
const { restoreRoom } = useConversations()

/** 点击"发送消息"：找到或创建 DM 房间并跳转 */
async function onSendMessage() {
  const uid = memberInfo.value?.userId
  if (!uid || !uid.startsWith('@'))
    return
  emit('close')
  try {
    const roomId = await findOrCreateDm(uid)
    // 确保房间在会话列表中可见（可能之前被归档/隐藏）
    restoreRoom(roomId)
    chatStore.setCurrentRoom(roomId)
  }
  catch (err) {
    console.error('打开私聊失败:', err)
  }
}

// --- 屏蔽/拉黑 ---
const isOtherUser = computed(() => {
  if (!memberInfo.value?.userId)
    return false
  const myId = getClient().getUserId()
  return memberInfo.value.userId.startsWith('@') && memberInfo.value.userId !== myId
})

const blocked = ref(false)

watch(memberInfo, (info) => {
  if (info?.userId && info.userId.startsWith('@')) {
    blocked.value = isUserBlocked(info.userId)
  }
  else {
    blocked.value = false
  }
}, { immediate: true })

async function onToggleBlock() {
  const uid = memberInfo.value?.userId
  if (!uid)
    return

  if (blocked.value) {
    // 解除屏蔽 — 无需确认
    await unblockUser(uid)
    blocked.value = false
  }
  else {
    // 屏蔽前确认
    const confirmed = await ask(t('settings.block_confirm'), {
      title: t('settings.block_confirm_title'),
      kind: 'warning',
    })
    if (!confirmed)
      return
    await blockUser(uid)
    blocked.value = true
  }
}
</script>

<template>
  <Teleport to="body">
    <!-- 背景遮罩 - 微妙模糊 -->
    <Transition name="info-overlay">
      <div
        v-if="isVisible && memberInfo"
        class="fixed inset-0 z-[99] bg-black/5 backdrop-blur-[2px]"
        @click="emit('close')"
      />
    </Transition>

    <Transition name="info-panel">
      <div
        v-if="isVisible && memberInfo"
        :style="panelStyle"
        class="info-card w-[272px] bg-popover/95 text-popover-foreground rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.06)] overflow-hidden backdrop-blur-xl"
      >
        <!-- 顶部装饰渐变条 -->
        <div
          class="h-[52px] relative overflow-hidden"
          :style="{ background: gradient }"
        >
          <div class="absolute inset-0 bg-gradient-to-b from-white/10 to-black/10" />
          <div class="absolute inset-0 opacity-20" style="background-image: url('data:image/svg+xml,%3Csvg width=&quot;40&quot; height=&quot;40&quot; viewBox=&quot;0 0 40 40&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;%3E%3Cpath d=&quot;M0 0h20v20H0zM20 20h20v20H20z&quot; fill=&quot;%23fff&quot; fill-opacity=&quot;.08&quot;/%3E%3C/svg%3E')" />
          <button
            class="absolute top-2 right-2 p-1 rounded-lg bg-black/15 hover:bg-black/25 text-white/80 hover:text-white transition-all duration-150 hover:scale-110 active:scale-95"
            @click="emit('close')"
          >
            <X :size="13" />
          </button>
        </div>

        <!-- 头像 - 浮出渐变条 -->
        <div class="flex flex-col items-center -mt-8 px-5 pb-1 info-avatar-section">
          <div class="relative">
            <img
              v-if="resolvedAvatar"
              :src="resolvedAvatar"
              :alt="memberInfo.displayName"
              class="w-[60px] h-[60px] rounded-[16px] object-cover ring-[3px] ring-popover shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
            >
            <div
              v-else
              class="w-[60px] h-[60px] rounded-[16px] flex items-center justify-center text-lg font-bold text-white ring-[3px] ring-popover shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
              :style="{ background: gradient }"
            >
              {{ letter }}
            </div>
            <!-- 在线状态点 -->
            <div class="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 ring-[2.5px] ring-popover shadow-[0_1px_4px_rgba(16,185,129,0.4)]" />
          </div>

          <h3 class="mt-3 text-[14px] font-semibold truncate max-w-full tracking-tight">
            {{ memberInfo.displayName }}
          </h3>
          <p class="text-[11px] text-muted-foreground/60 mt-0.5 truncate max-w-full font-mono tracking-tight">
            {{ memberInfo.userId }}
          </p>
          <p
            v-if="userStatusMsg"
            class="text-[11px] text-muted-foreground/70 mt-1 truncate max-w-full"
          >
            {{ userStatusMsg }}
          </p>
        </div>

        <!-- 已屏蔽横幅 -->
        <div
          v-if="blocked && isOtherUser"
          class="mx-3.5 mt-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-[11px] font-medium flex items-center gap-2"
        >
          <Ban :size="12" />
          {{ t('settings.user_blocked_banner') }}
        </div>

        <!-- 信息行 - 卡片式 -->
        <div class="px-3.5 pt-2.5 pb-2 space-y-1 info-details">
          <div
            v-if="room && !room.isDirect"
            class="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-accent/40 text-[11.5px] text-muted-foreground transition-colors hover:bg-accent/60"
          >
            <div class="w-6 h-6 rounded-lg bg-accent flex items-center justify-center">
              <Hash :size="12" class="opacity-60" />
            </div>
            <span class="font-medium">{{ t('chat.member_count', { count: memberCount }) }}</span>
          </div>

          <div
            v-if="room?.isEncrypted"
            class="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-emerald-500/8 text-[11.5px] text-emerald-600 dark:text-emerald-400 transition-colors hover:bg-emerald-500/12"
          >
            <div class="w-6 h-6 rounded-lg bg-emerald-500/12 flex items-center justify-center">
              <Shield :size="12" />
            </div>
            <span class="font-medium">{{ t('chat.e2e_encrypted') }}</span>
          </div>

          <div
            v-if="room?.isDirect"
            class="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-accent/40 text-[11.5px] text-muted-foreground transition-colors hover:bg-accent/60"
          >
            <div class="w-6 h-6 rounded-lg bg-accent flex items-center justify-center">
              <AtSign :size="12" class="opacity-60" />
            </div>
            <span class="truncate font-medium">{{ room.dmUserId }}</span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="px-3.5 pb-3.5 pt-1 space-y-1.5 info-action">
          <button
            class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold hover:brightness-110 active:scale-[0.98] transition-all duration-150 shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
            @click="onSendMessage()"
          >
            <MessageCircle :size="13" />
            {{ t('chat.send_message') }}
          </button>
          <!-- 屏蔽/解除屏蔽按钮 -->
          <button
            v-if="isOtherUser"
            class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium transition-all duration-150 active:scale-[0.98]"
            :class="blocked
              ? 'bg-accent text-muted-foreground hover:bg-accent/80'
              : 'bg-destructive/10 text-destructive hover:bg-destructive/15'"
            @click="onToggleBlock()"
          >
            <Ban :size="13" />
            {{ blocked ? t('settings.unblock_user') : t('settings.block_user') }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 卡片入场 */
.info-panel-enter-active {
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
.info-panel-leave-active {
  transition: all 0.18s cubic-bezier(0.4, 0, 1, 1);
}
.info-panel-enter-from {
  opacity: 0;
  transform: scale(0.92) translateY(-6px);
}
.info-panel-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-3px);
}

/* 遮罩层 */
.info-overlay-enter-active {
  transition: all 0.25s ease-out;
}
.info-overlay-leave-active {
  transition: all 0.2s ease-in;
}
.info-overlay-enter-from,
.info-overlay-leave-to {
  opacity: 0;
  backdrop-filter: blur(0);
}

/* 交错入场动画 */
.info-card .info-avatar-section {
  animation: conv-slide-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: 0.06s;
}
.info-card .info-details {
  animation: conv-slide-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: 0.12s;
}
.info-card .info-action {
  animation: conv-slide-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: 0.18s;
}
</style>

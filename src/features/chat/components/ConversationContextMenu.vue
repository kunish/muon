<script setup lang="ts">
import { leaveRoom, toggleRoomMute, toggleRoomPin } from '@matrix/index'
import { ask } from '@tauri-apps/plugin-dialog'
import {
  Bell,
  BellOff,
  Eye,
  EyeOff,
  LogOut,
  Pin,
  PinOff,
} from 'lucide-vue-next'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { isDirectRoom } from '@/shared/lib/roomUtils'
import { useConversations } from '../composables/useConversations'
import { useChatStore } from '../stores/chatStore'

const store = useChatStore()
const { t } = useI18n()
const { refresh, removeRoom, archiveDm } = useConversations()

const menuRef = ref<HTMLElement | null>(null)

const isOpen = computed(() => !!store.contextMenu)
const roomId = computed(() => store.contextMenu?.roomId || '')
const pinned = computed(() => store.isPinned(roomId.value))
const muted = computed(() => store.isMuted(roomId.value))
const markedUnread = computed(() => store.isMarkedUnread(roomId.value))

// 菜单定位
const style = computed(() => {
  if (!store.contextMenu)
    return {}
  return {
    left: `${store.contextMenu.x}px`,
    top: `${store.contextMenu.y}px`,
  }
})

// 点击外部关闭
function onClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    store.closeContextMenu()
  }
}

watch(isOpen, (open) => {
  if (open) {
    setTimeout(() => document.addEventListener('mousedown', onClickOutside), 0)
  }
  else {
    document.removeEventListener('mousedown', onClickOutside)
  }
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
})

// --- 操作 ---
async function handlePin() {
  store.togglePin(roomId.value)
  try {
    await toggleRoomPin(roomId.value)
  }
  catch { /* Conduit 可能不支持 */ }
  refresh()
  store.closeContextMenu()
}

async function handleMute() {
  store.toggleMute(roomId.value)
  try {
    await toggleRoomMute(roomId.value)
  }
  catch { /* Conduit 可能不支持 */ }
  refresh()
  store.closeContextMenu()
}

function handleMarkUnread() {
  store.toggleMarkedUnread(roomId.value)
  store.closeContextMenu()
}

async function handleLeave() {
  const targetRoomId = roomId.value
  store.closeContextMenu()

  // 判断是否为 DM 房间
  const isDm = isDirectRoom(targetRoomId)

  const message = isDm
    ? t('chat.ctx_leave_dm_msg')
    : t('chat.ctx_leave_group_msg')

  const confirmed = await ask(message, {
    title: t('chat.ctx_leave_title'),
    kind: 'warning',
  })
  if (!confirmed)
    return
  try {
    if (store.currentRoomId === targetRoomId) {
      store.setCurrentRoom(null)
    }
    if (isDm) {
      // DM 房间：仅从列表隐藏（归档），不真正离开，保留历史消息
      archiveDm(targetRoomId)
    }
    else {
      // 群组房间：真正离开
      await leaveRoom(targetRoomId)
      removeRoom(targetRoomId)
    }
  }
  catch {
    toast.error(t('auth.error'))
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
      leave-active-class="transition-all duration-[120ms] ease-in"
      enter-from-class="translate-y-[-4px] scale-95 opacity-0"
      leave-to-class="scale-95 opacity-0"
    >
      <div
        v-if="isOpen"
        ref="menuRef"
        class="ctx-menu fixed z-50 min-w-[180px] py-1.5 rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]"
        :style="style"
        @contextmenu.prevent
      >
        <!-- 置顶 -->
        <button class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-foreground transition-all duration-100 hover:bg-accent active:scale-[0.98]" @click="handlePin">
          <component :is="pinned ? PinOff : Pin" :size="14" />
          <span>{{ pinned ? t('chat.ctx_unpin') : t('chat.ctx_pin') }}</span>
        </button>

        <!-- 免打扰 -->
        <button class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-foreground transition-all duration-100 hover:bg-accent active:scale-[0.98]" @click="handleMute">
          <component :is="muted ? Bell : BellOff" :size="14" />
          <span>{{ muted ? t('chat.ctx_unmute') : t('chat.ctx_mute') }}</span>
        </button>

        <!-- 标记未读/已读 -->
        <button class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-foreground transition-all duration-100 hover:bg-accent active:scale-[0.98]" @click="handleMarkUnread">
          <component :is="markedUnread ? Eye : EyeOff" :size="14" />
          <span>{{ markedUnread ? t('chat.ctx_mark_read') : t('chat.ctx_mark_unread') }}</span>
        </button>

        <div class="mx-3 my-1 h-px bg-border/50" />

        <!-- 退出会话 -->
        <button class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-destructive transition-all duration-100 hover:bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)] active:scale-[0.98]" @click="handleLeave">
          <LogOut :size="14" />
          <span>{{ t('chat.ctx_leave') }}</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

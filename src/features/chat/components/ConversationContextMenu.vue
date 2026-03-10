<script setup lang="ts">
import { getClient } from '@matrix/client'
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
  const client = getClient()
  const directEvent = client.getAccountData('m.direct' as any)
  const directContent: Record<string, string[]> = directEvent?.getContent() ?? {}
  const isDm = Object.values(directContent).some(ids => ids.includes(targetRoomId))

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
  catch (err) {
    console.error('退出房间失败:', err)
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="ctx-menu">
      <div
        v-if="isOpen"
        ref="menuRef"
        class="ctx-menu fixed z-50 min-w-[180px] py-1.5 rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]"
        :style="style"
        @contextmenu.prevent
      >
        <!-- 置顶 -->
        <button class="ctx-item" @click="handlePin">
          <component :is="pinned ? PinOff : Pin" :size="14" />
          <span>{{ pinned ? t('chat.ctx_unpin') : t('chat.ctx_pin') }}</span>
        </button>

        <!-- 免打扰 -->
        <button class="ctx-item" @click="handleMute">
          <component :is="muted ? Bell : BellOff" :size="14" />
          <span>{{ muted ? t('chat.ctx_unmute') : t('chat.ctx_mute') }}</span>
        </button>

        <!-- 标记未读/已读 -->
        <button class="ctx-item" @click="handleMarkUnread">
          <component :is="markedUnread ? Eye : EyeOff" :size="14" />
          <span>{{ markedUnread ? t('chat.ctx_mark_read') : t('chat.ctx_mark_unread') }}</span>
        </button>

        <div class="ctx-divider" />

        <!-- 退出会话 -->
        <button class="ctx-item ctx-danger" @click="handleLeave">
          <LogOut :size="14" />
          <span>{{ t('chat.ctx_leave') }}</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ctx-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 14px;
  font-size: 13px;
  color: var(--color-foreground);
  cursor: pointer;
  transition: all 0.12s ease;
  border-radius: 6px;
  margin: 0 4px;
  width: calc(100% - 8px);
}
.ctx-item:hover {
  background: var(--color-accent);
}
.ctx-item:active {
  transform: scale(0.98);
}

.ctx-danger {
  color: var(--color-destructive);
}
.ctx-danger:hover {
  background: color-mix(in srgb, var(--color-destructive) 10%, transparent);
}

.ctx-divider {
  height: 1px;
  margin: 4px 12px;
  background: var(--color-border);
  opacity: 0.5;
}

/* 入场/退场动画 */
.ctx-menu-enter-active {
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.ctx-menu-leave-active {
  transition: all 0.12s ease-in;
}
.ctx-menu-enter-from {
  opacity: 0;
  transform: scale(0.92) translateY(-4px);
}
.ctx-menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>

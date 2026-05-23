<script setup lang="ts">
import { leaveRoom, toggleRoomMute, toggleRoomPin } from '@matrix/index';
import { isDirectRoom } from '@matrix/roomUtils';
import { onClickOutside } from '@vueuse/core';
import { Bell, BellOff, Eye, EyeOff, LogOut, Pin, PinOff } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { ask } from '@/desktop/dialog';
import { useContextMenuScrollLock } from '@/shared/composables/useContextMenuScrollLock';
import { useViewportClampedFloating } from '@/shared/composables/useViewportClampedFloating';
import { useConversations } from '../composables/useConversations';
import { useChatStore } from '../stores/chatStore';

const store = useChatStore();
const { t } = useI18n();
const { refresh, removeRoom, archiveDm } = useConversations();

const menuRef = ref<HTMLElement | null>(null);

const isOpen = computed(() => !!store.contextMenu);
const roomId = computed(() => store.contextMenu?.roomId || '');
const pinned = computed(() => store.isPinned(roomId.value));
const muted = computed(() => store.isMuted(roomId.value));
const markedUnread = computed(() => store.isMarkedUnread(roomId.value));
const menuPosition = computed(() => ({
  x: store.contextMenu?.x ?? 0,
  y: store.contextMenu?.y ?? 0,
}));
const { style } = useViewportClampedFloating({
  open: isOpen,
  position: menuPosition,
  element: menuRef,
  fallbackSize: { width: 180, height: 176 },
});

useContextMenuScrollLock(isOpen);

// 点击外部关闭
onClickOutside(menuRef, () => {
  if (isOpen.value) store.closeContextMenu();
});

// --- 操作 ---
async function handlePin() {
  const targetRoomId = roomId.value;
  const nextPinned = !store.isPinned(targetRoomId);
  store.setPin(targetRoomId, nextPinned);
  try {
    await toggleRoomPin(targetRoomId);
  } catch {
    /* Conduit 可能不支持 */
  }
  refresh();
  store.closeContextMenu();
}

async function handleMute() {
  store.toggleMute(roomId.value);
  try {
    await toggleRoomMute(roomId.value);
  } catch {
    /* Conduit 可能不支持 */
  }
  refresh();
  store.closeContextMenu();
}

function handleMarkUnread() {
  store.toggleMarkedUnread(roomId.value);
  store.closeContextMenu();
}

async function handleLeave() {
  const targetRoomId = roomId.value;
  store.closeContextMenu();

  // 判断是否为 DM 房间
  const isDm = isDirectRoom(targetRoomId);

  const message = isDm ? t('chat.ctx_leave_dm_msg') : t('chat.ctx_leave_group_msg');

  const confirmed = await ask(message, {
    title: t('chat.ctx_leave_title'),
    kind: 'warning',
  });
  if (!confirmed) return;
  try {
    if (store.currentRoomId === targetRoomId) {
      store.setCurrentRoom(null);
    }
    if (isDm) {
      // DM 房间：仅从列表隐藏（归档），不真正离开，保留历史消息
      archiveDm(targetRoomId);
    } else {
      // 群组房间：真正离开
      await leaveRoom(targetRoomId);
      removeRoom(targetRoomId);
    }
  } catch {
    toast.error(t('auth.error'));
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
      <div v-if="isOpen" ref="menuRef" class="workspace-menu ctx-menu fixed" :style="style" @contextmenu.prevent>
        <!-- 置顶 -->
        <button class="workspace-menu-item mx-0 w-full text-foreground active:scale-[0.98]" @click="handlePin">
          <component :is="pinned ? PinOff : Pin" :size="14" />
          <span>{{ pinned ? t('chat.ctx_unpin') : t('chat.ctx_pin') }}</span>
        </button>

        <!-- 免打扰 -->
        <button class="workspace-menu-item mx-0 w-full text-foreground active:scale-[0.98]" @click="handleMute">
          <component :is="muted ? Bell : BellOff" :size="14" />
          <span>{{ muted ? t('chat.ctx_unmute') : t('chat.ctx_mute') }}</span>
        </button>

        <!-- 标记未读/已读 -->
        <button class="workspace-menu-item mx-0 w-full text-foreground active:scale-[0.98]" @click="handleMarkUnread">
          <component :is="markedUnread ? Eye : EyeOff" :size="14" />
          <span>{{ markedUnread ? t('chat.ctx_mark_read') : t('chat.ctx_mark_unread') }}</span>
        </button>

        <div class="mx-3 my-1 h-px bg-border/50" />

        <!-- 退出会话 -->
        <button
          class="workspace-menu-item workspace-menu-item-destructive mx-0 w-full active:scale-[0.98]"
          @click="handleLeave"
        >
          <LogOut :size="14" />
          <span>{{ t('chat.ctx_leave') }}</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

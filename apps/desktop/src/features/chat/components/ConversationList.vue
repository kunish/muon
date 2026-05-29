<script setup lang="ts">
import type { RoomSummary } from '@matrix/types';
import { getClient } from '@matrix/client';
import { normalizeRoomId } from '@matrix/roomUtils';
import { Avatar } from '@muon/ui/avatar';
import { CheckCheck, MessageSquarePlus, Search } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useGlobalUiStore } from '@/app/stores/globalUiStore';
import { useConversations } from '../composables/useConversations';
import { useGlobalTyping } from '../composables/useGlobalTyping';
import { useChatStore } from '../stores/chatStore';
import ConversationContextMenu from './ConversationContextMenu.vue';
import ConversationItem from './ConversationItem.vue';
import UserInfoPanel from './UserInfoPanel.vue';

const router = useRouter();
const route = useRoute();
const store = useChatStore();
const globalUi = useGlobalUiStore();
const { t } = useI18n();
const { conversations, pinnedCount, isLoading, totalUnreadCount, markAllRead } = useConversations();
const { getTypingUsers } = useGlobalTyping();

const currentUser = computed(() => {
  const client = getClient();
  const userId = client.getUserId();
  const user = userId ? client.getUser(userId) : null;
  return {
    displayName: user?.displayName || userId?.split(':')[0]?.slice(1) || '',
    mxcAvatar: user?.avatarUrl || undefined,
    userId: userId || '',
  };
});

// --- 交互 ---
const infoPanelRoom = ref<RoomSummary | null>(null);
const infoPanelPos = ref({ x: 0, y: 0 });
const searchFocused = ref(false);

function selectRoom(roomId: string) {
  store.selectRoomFromHistory(roomId);
  router.push(`/dm/${encodeURIComponent(roomId)}`);
}

function onAvatarClick(room: RoomSummary, event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  infoPanelPos.value = { x: rect.right, y: rect.top };
  infoPanelRoom.value = room;
}

// --- 筛选标签 ---
const filterTabs = computed(() => [
  { key: 'all' as const, label: t('chat.filter_all') },
  { key: 'unread' as const, label: t('chat.filter_unread') },
  { key: 'dm' as const, label: t('chat.filter_dm') },
  { key: 'group' as const, label: t('chat.filter_group') },
]);

// --- 右键菜单 ---
function onContextMenu(roomId: string, event: MouseEvent) {
  store.openContextMenu(roomId, event.clientX, event.clientY);
}

// --- 快捷入口：置顶的 DM 联系人 ---
const quickAccessContacts = computed(() => {
  // 飞书风格：最多显示 5 个，从左侧开始排列
  const dms = conversations.value.filter((r) => r.isDirect && store.isPinned(r.roomId)).slice(0, 5);
  return dms.map((r) => ({
    roomId: r.roomId,
    name: r.name,
    mxcAvatar: r.avatar || r.dmUserAvatar,
  }));
});

function selectQuickContact(roomId: string) {
  store.selectRoomFromHistory(roomId);
  router.push(`/dm/${encodeURIComponent(roomId)}`);
}

const activeRoomId = computed(
  () =>
    normalizeRoomId(store.currentRoomId) ??
    normalizeRoomId((route.params.roomId || route.params.channelId) as string | undefined),
);

function isConversationContextMenuOpen(roomId: string): boolean {
  return normalizeRoomId(store.contextMenu?.roomId) === normalizeRoomId(roomId);
}
</script>

<template>
  <div class="flex flex-col h-full bg-sidebar w-full">
    <div class="relative z-10 border-b border-sidebar-border px-3 pb-4 pt-6">
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <Avatar
            :src="currentUser.mxcAvatar"
            :alt="currentUser.displayName"
            :color-id="currentUser.userId"
            size="xs"
            shape="circle"
            class="h-8 w-8 cursor-pointer"
            @click="router.push('/settings')"
          />
          <h2 class="text-[18px] font-semibold leading-6 text-foreground">
            {{ t('chat.messages_title') }}
          </h2>
        </div>
        <button
          class="conv-new-btn rounded-md p-1.5 text-primary transition-colors hover:bg-accent"
          :title="t('chat.new_conversation')"
          @click="globalUi.openNewChat"
        >
          <MessageSquarePlus :size="15" />
        </button>
      </div>

      <div class="relative conv-search-wrap">
        <Search
          class="absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-150"
          :class="searchFocused ? 'text-primary' : 'text-muted-foreground'"
          :size="15"
        />
        <input
          :value="store.searchQuery"
          type="text"
          :placeholder="t('chat.search_conversation')"
          class="conv-search h-8 w-full rounded-md border border-transparent bg-input pl-8 pr-3 text-[13px] text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground focus:border-primary"
          @input="store.setSearchQuery(($event.target as HTMLInputElement).value)"
          @focus="searchFocused = true"
          @blur="searchFocused = false"
        />
      </div>
    </div>

    <!-- 快捷入口：置顶联系人 — 从左侧开始排列 -->
    <div
      v-if="quickAccessContacts.length > 0 && !store.searchQuery"
      class="muon-scrollbar-hidden flex items-start justify-start gap-2 overflow-x-auto border-b border-sidebar-border px-3 py-2"
    >
      <button
        v-for="c in quickAccessContacts"
        :key="c.roomId"
        class="group flex w-12 min-w-0 shrink-0 cursor-pointer flex-col items-center gap-1"
        :title="c.name"
        @click="selectQuickContact(c.roomId)"
      >
        <div class="relative">
          <Avatar
            :src="c.mxcAvatar"
            :alt="c.name"
            :color-id="c.roomId"
            size="sm"
            shape="circle"
            class="h-9 w-9 cursor-pointer transition-transform duration-150 group-hover:scale-105"
          />
        </div>
        <span
          class="w-full truncate text-center text-[10px] leading-tight text-muted-foreground transition-colors group-hover:text-foreground"
        >
          {{ c.name }}
        </span>
      </button>
    </div>

    <!-- 虚拟滚动会话列表 - 带顶部渐隐遮罩 -->
    <div class="muon-scrollbar muon-scrollbar-compact flex-1 overflow-y-auto px-2 pt-3 scroll-smooth">
      <div class="mb-3 flex items-center gap-1 px-1">
        <button
          v-for="tab in filterTabs"
          :key="tab.key"
          class="cursor-pointer select-none rounded-md px-2.5 py-[3px] text-[11px] font-semibold transition-colors duration-150 active:scale-95"
          :class="
            store.activeFilter === tab.key
              ? 'bg-accent text-foreground shadow-[inset_2px_0_0_var(--color-primary)]'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          "
          @click="store.setFilter(tab.key)"
        >
          {{ tab.label }}
        </button>
        <button
          v-if="totalUnreadCount > 0"
          class="ml-auto flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-[3px] text-[11px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground active:scale-95"
          :title="t('chat.mark_all_read')"
          data-testid="conversation-mark-all-read"
          @click="markAllRead"
        >
          <CheckCheck :size="13" />
          <span>{{ t('chat.mark_all_read') }}</span>
        </button>
      </div>

      <!-- 加载骨架屏 - 微光效果 -->
      <div v-if="isLoading" class="space-y-0.5 px-1">
        <div
          v-for="i in 6"
          :key="i"
          class="flex items-center gap-3 rounded-md px-2.5 py-[9px]"
          :style="{ animationDelay: `${i * 80}ms` }"
        >
          <div
            class="h-10 w-10 shrink-0 animate-[skeleton-shimmer_1.8s_ease-in-out_infinite] rounded-md bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-accent)_50%,transparent)_0%,color-mix(in_srgb,var(--color-accent)_90%,transparent)_40%,color-mix(in_srgb,var(--color-accent)_50%,transparent)_100%)] bg-[length:200%_100%]"
          />
          <div class="flex-1 space-y-2.5">
            <div
              class="h-3 animate-[skeleton-shimmer_1.8s_ease-in-out_infinite] rounded-md bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-accent)_50%,transparent)_0%,color-mix(in_srgb,var(--color-accent)_90%,transparent)_40%,color-mix(in_srgb,var(--color-accent)_50%,transparent)_100%)] bg-[length:200%_100%]"
              :style="{ width: `${55 + i * 6}%` }"
            />
            <div
              class="h-2.5 animate-[skeleton-shimmer_1.8s_ease-in-out_infinite] rounded-md bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-accent)_50%,transparent)_0%,color-mix(in_srgb,var(--color-accent)_90%,transparent)_40%,color-mix(in_srgb,var(--color-accent)_50%,transparent)_100%)] bg-[length:200%_100%]"
              :style="{ width: `${70 + i * 3}%` }"
            />
          </div>
        </div>
      </div>

      <!-- 会话列表：普通流式布局，避免虚拟测量把联系人之间撑出大空隙 -->
      <div v-else-if="conversations.length > 0" class="space-y-0 px-0.5 pb-2">
        <template v-for="(conversation, index) in conversations" :key="conversation.roomId">
          <div v-if="pinnedCount > 0 && index === pinnedCount" class="flex items-center px-4 py-1">
            <div class="h-px flex-1 bg-border/40" />
          </div>

          <ConversationItem
            :room="conversation"
            :active="normalizeRoomId(conversation.roomId) === activeRoomId"
            :typing-users="getTypingUsers(conversation.roomId)"
            :context-menu-open="isConversationContextMenuOpen(conversation.roomId)"
            class="w-full"
            @select="selectRoom"
            @avatar-click="onAvatarClick"
            @contextmenu="onContextMenu"
          />
        </template>
      </div>

      <!-- 空状态 - 增强氛围 -->
      <div v-else class="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div
          class="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-accent"
          style="animation: breathe 3s ease-in-out infinite"
        >
          <MessageSquarePlus :size="18" class="opacity-60" />
        </div>
        <span class="text-[12px] font-medium">{{
          store.searchQuery ? t('chat.no_match') : t('chat.no_conversations')
        }}</span>
        <span v-if="!store.searchQuery" class="mt-1 text-[11px] text-muted-foreground">{{ t('chat.start_new') }}</span>
      </div>
    </div>

    <!-- 用户信息面板 -->
    <UserInfoPanel :room="infoPanelRoom" :position="infoPanelPos" @close="infoPanelRoom = null" />

    <!-- 右键菜单 -->
    <ConversationContextMenu />
  </div>
</template>

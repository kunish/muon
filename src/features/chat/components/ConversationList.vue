<script setup lang="ts">
import type { RoomSummary } from '@matrix/types'
import { getClient } from '@matrix/client'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { MessageSquarePlus, Search } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Avatar } from '@/shared/components/ui/avatar'
import { normalizeRoomId } from '@/shared/lib/roomUtils'
import { useConversations } from '../composables/useConversations'
import { useGlobalTyping } from '../composables/useGlobalTyping'
import { useChatStore } from '../stores/chatStore'
import ConversationContextMenu from './ConversationContextMenu.vue'
import ConversationItem from './ConversationItem.vue'
import NewChatDialog from './NewChatDialog.vue'
import UserInfoPanel from './UserInfoPanel.vue'

const router = useRouter()
const route = useRoute()
const store = useChatStore()
const { t } = useI18n()
const { conversations, pinnedCount, isLoading } = useConversations()
const { getTypingUsers } = useGlobalTyping()

const currentUser = computed(() => {
  const client = getClient()
  const userId = client.getUserId()
  const user = userId ? client.getUser(userId) : null
  return {
    displayName: user?.displayName || userId?.split(':')[0]?.slice(1) || '',
    mxcAvatar: user?.avatarUrl || undefined,
    userId: userId || '',
  }
})

// --- 虚拟滚动 ---
const scrollRef = ref<HTMLElement | null>(null)
const ITEM_HEIGHT = 56

const virtualizer = useVirtualizer(computed(() => ({
  count: conversations.value.length,
  getScrollElement: () => scrollRef.value,
  estimateSize: () => ITEM_HEIGHT,
  overscan: 6,
})))

const virtualItems = computed(() => virtualizer.value.getVirtualItems())
const totalHeight = computed(() => virtualizer.value.getTotalSize())

// --- 交互 ---
const infoPanelRoom = ref<RoomSummary | null>(null)
const infoPanelPos = ref({ x: 0, y: 0 })
const searchFocused = ref(false)

function selectRoom(roomId: string) {
  store.setCurrentRoom(roomId)
  router.push(`/dm/${encodeURIComponent(roomId)}`)
}

function onAvatarClick(room: RoomSummary, event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  infoPanelPos.value = { x: rect.right, y: rect.top }
  infoPanelRoom.value = room
}

// --- 筛选标签 ---
const filterTabs = computed(() => [
  { key: 'all' as const, label: t('chat.filter_all') },
  { key: 'unread' as const, label: t('chat.filter_unread') },
  { key: 'dm' as const, label: t('chat.filter_dm') },
  { key: 'group' as const, label: t('chat.filter_group') },
])

// --- 新建会话 ---
const showNewChat = ref(false)

// --- 右键菜单 ---
function onContextMenu(roomId: string, event: MouseEvent) {
  store.openContextMenu(roomId, event.clientX, event.clientY)
}

// --- 快捷入口：最近/置顶的 DM 联系人 ---
const quickAccessContacts = computed(() => {
  // 飞书风格：最多显示 5 个，等分容器宽度，永不溢出
  const dms = conversations.value
    .filter(r => r.isDirect)
    .slice(0, 5)
  return dms.map(r => ({
    roomId: r.roomId,
    name: r.name,
    mxcAvatar: r.avatar || r.dmUserAvatar,
  }))
})

function selectQuickContact(roomId: string) {
  store.setCurrentRoom(roomId)
  router.push(`/dm/${encodeURIComponent(roomId)}`)
}

const activeRoomId = computed(() =>
  normalizeRoomId((route.params.roomId || route.params.channelId) as string | undefined) ?? normalizeRoomId(store.currentRoomId),
)
</script>

<template>
  <div class="flex flex-col h-full bg-sidebar">
    <!-- 顶栏 -->
    <div class="relative z-10 px-3 pt-3 pb-1.5 after:absolute after:bottom-0 after:left-3 after:right-3 after:h-px after:bg-[linear-gradient(90deg,transparent,var(--color-border)_20%,var(--color-border)_80%,transparent)] after:opacity-50 after:content-['']">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2.5">
          <Avatar
            :src="currentUser.mxcAvatar"
            :alt="currentUser.displayName"
            :color-id="currentUser.userId"
            size="xs"
            shape="circle"
            :clickable="true"
            class="w-7 h-7 ring-1 ring-border/30"
            @click="router.push('/settings')"
          />
          <h2 class="text-[14px] font-semibold tracking-tight text-foreground/90">
            {{ t('chat.messages_title') }}
          </h2>
        </div>
        <button
          class="conv-new-btn p-1.5 rounded-lg hover:bg-accent text-muted-foreground/60 hover:text-muted-foreground transition-all duration-200 hover:scale-110 active:scale-95"
          :title="t('chat.new_conversation')"
          @click="showNewChat = true"
        >
          <MessageSquarePlus :size="15" />
        </button>
      </div>

      <!-- 搜索 - 增强聚焦态 -->
      <div class="relative conv-search-wrap">
        <Search
          class="absolute left-2.5 top-1/2 -translate-y-1/2 transition-all duration-200"
          :class="searchFocused ? 'text-primary/70 scale-110' : 'text-muted-foreground/40'"
          :size="13"
        />
        <input
          :value="store.searchQuery"
          type="text"
          :placeholder="t('chat.search_conversation')"
          class="conv-search w-full h-[30px] pl-7.5 pr-3 text-[12px] rounded-lg bg-accent/40 border border-transparent outline-none placeholder:text-muted-foreground/35 transition-all duration-200 focus:bg-accent/70 focus:border-ring/20 focus:shadow-[0_0_0_3px_rgba(var(--color-ring-rgb,0,0,0),0.06)]"
          @input="store.setSearchQuery(($event.target as HTMLInputElement).value)"
          @focus="searchFocused = true"
          @blur="searchFocused = false"
        >
      </div>
    </div>

    <!-- 快捷入口：最近联系人 — 飞书风格等分布局，永不溢出 -->
    <div
      v-if="quickAccessContacts.length > 0 && !store.searchQuery"
      class="flex items-start border-b border-[color-mix(in_srgb,var(--color-border)_40%,transparent)] px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <button
        v-for="c in quickAccessContacts"
        :key="c.roomId"
        class="flex flex-col items-center gap-1 min-w-0 flex-1 group cursor-pointer"
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
            :clickable="true"
            class="w-9 h-9 transition-all duration-200 group-hover:scale-110"
          />
        </div>
        <span class="text-[10px] text-muted-foreground/60 w-full text-center truncate leading-tight group-hover:text-foreground/80 transition-colors">
          {{ c.name }}
        </span>
      </button>
    </div>

    <!-- 虚拟滚动会话列表 - 带顶部渐隐遮罩 -->
    <div
      ref="scrollRef"
      class="flex-1 overflow-y-auto px-1.5 pt-0.5 scroll-smooth [mask-image:linear-gradient(to_bottom,transparent_0px,black_8px,black_calc(100%-8px),transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,transparent_0px,black_8px,black_calc(100%-8px),transparent_100%)] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-[3px] [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:transition-colors [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground"
    >
      <!-- 筛选标签 -->
      <div class="flex items-center gap-1 px-2.5 mb-1">
        <button
          v-for="tab in filterTabs"
          :key="tab.key"
          class="cursor-pointer select-none rounded-md px-2.5 py-[3px] text-[11px] transition-all duration-150 active:scale-95"
          :class="store.activeFilter === tab.key
            ? 'bg-primary/10 text-primary font-semibold'
            : 'text-muted-foreground/50 hover:text-muted-foreground/80 hover:bg-accent/50'"
          @click="store.setFilter(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- 加载骨架屏 - 微光效果 -->
      <div v-if="isLoading" class="space-y-0.5 px-1">
        <div
          v-for="i in 6"
          :key="i"
          class="flex items-center gap-3 px-2.5 py-[9px] rounded-xl"
          :style="{ animationDelay: `${i * 80}ms` }"
        >
          <div class="h-10 w-10 shrink-0 animate-[skeleton-shimmer_1.8s_ease-in-out_infinite] rounded-[12px] bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-accent)_50%,transparent)_0%,color-mix(in_srgb,var(--color-accent)_90%,transparent)_40%,color-mix(in_srgb,var(--color-accent)_50%,transparent)_100%)] bg-[length:200%_100%]" />
          <div class="flex-1 space-y-2.5">
            <div class="h-3 animate-[skeleton-shimmer_1.8s_ease-in-out_infinite] rounded-md bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-accent)_50%,transparent)_0%,color-mix(in_srgb,var(--color-accent)_90%,transparent)_40%,color-mix(in_srgb,var(--color-accent)_50%,transparent)_100%)] bg-[length:200%_100%]" :style="{ width: `${55 + i * 6}%` }" />
            <div class="h-2.5 animate-[skeleton-shimmer_1.8s_ease-in-out_infinite] rounded-md bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-accent)_50%,transparent)_0%,color-mix(in_srgb,var(--color-accent)_90%,transparent)_40%,color-mix(in_srgb,var(--color-accent)_50%,transparent)_100%)] bg-[length:200%_100%]" :style="{ width: `${70 + i * 3}%` }" />
          </div>
        </div>
      </div>

      <!-- 虚拟列表容器 - 传递交错索引 -->
      <div
        v-else-if="conversations.length > 0"
        class="relative w-full"
        :style="{ height: `${totalHeight}px` }"
      >
        <!-- 飞书风格：置顶/非置顶分隔线 -->
        <div
          v-if="pinnedCount > 0 && pinnedCount < conversations.length"
          class="absolute left-0 w-full flex items-center px-4 pointer-events-none z-10"
          :style="{ top: `${pinnedCount * ITEM_HEIGHT - 1}px`, height: '1px' }"
        >
          <div class="flex-1 h-px bg-border/40" />
        </div>

        <ConversationItem
          v-for="vItem in virtualItems"
          :key="conversations[vItem.index].roomId"
          :room="conversations[vItem.index]"
          :active="normalizeRoomId(conversations[vItem.index].roomId) === activeRoomId"
          :typing-users="getTypingUsers(conversations[vItem.index].roomId)"
          class="absolute top-0 left-0 w-full"
          :style="{ transform: `translateY(${vItem.start}px)` }"
          @select="selectRoom"
          @avatar-click="onAvatarClick"
          @contextmenu="onContextMenu"
        />
      </div>

      <!-- 空状态 - 增强氛围 -->
      <div
        v-else
        class="flex flex-col items-center justify-center py-16 text-muted-foreground/50"
      >
        <div
          class="w-11 h-11 rounded-xl bg-accent/50 flex items-center justify-center mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          style="animation: breathe 3s ease-in-out infinite"
        >
          <MessageSquarePlus :size="18" class="opacity-35" />
        </div>
        <span class="text-[12px] font-medium">{{ store.searchQuery ? t('chat.no_match') : t('chat.no_conversations') }}</span>
        <span v-if="!store.searchQuery" class="text-[11px] mt-1 text-muted-foreground/30">{{ t('chat.start_new') }}</span>
      </div>
    </div>

    <!-- 用户信息面板 -->
    <UserInfoPanel
      :room="infoPanelRoom"
      :position="infoPanelPos"
      @close="infoPanelRoom = null"
    />

    <!-- 右键菜单 -->
    <ConversationContextMenu />

    <!-- 新建会话对话框 -->
    <NewChatDialog v-if="showNewChat" @close="showNewChat = false" />
  </div>
</template>

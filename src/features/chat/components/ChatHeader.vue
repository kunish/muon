<script setup lang="ts">
import type { SidePanelType } from '../stores/chatStore'
import { getRoomTopic } from '@matrix/rooms'
import { AtSign, Bell, FileText, FolderOpen, Hash, Lock, MessageSquareText, MoreHorizontal, Pin, Plus, Search, Star, Timer, Users } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isDirectRoom } from '@matrix/roomUtils'
import { useCurrentRoom } from '../composables/useCurrentRoom'
import { useChatStore } from '../stores/chatStore'
import DisappearingMessageSettings from './DisappearingMessageSettings.vue'

type ChatContentTab = 'chat' | 'docs' | 'files'

const props = withDefaults(defineProps<{
  activeTab?: ChatContentTab
}>(), {
  activeTab: 'chat',
})

const emit = defineEmits<{
  'update:activeTab': [tab: ChatContentTab]
}>()

const { room, currentRoomId } = useCurrentRoom()
const store = useChatStore()
const { t } = useI18n()
const showDisappearing = ref(false)
const showMore = ref(false)

const isDirect = computed(() => currentRoomId.value ? isDirectRoom(currentRoomId.value) : false)

const isEncrypted = computed(() => {
  if (!room.value)
    return false
  return room.value.hasEncryptionStateEvent()
})

/** 频道话题，截断显示在频道名后方 */
const roomTopic = computed(() => {
  if (!currentRoomId.value)
    return ''
  return getRoomTopic(currentRoomId.value)
})

const contentTabs = computed(() => [
  { id: 'chat' as const, label: t('chat.tab_chat'), icon: MessageSquareText },
  { id: 'docs' as const, label: t('chat.tab_docs'), icon: FileText },
  { id: 'files' as const, label: t('chat.tab_file'), icon: FolderOpen },
])

const sidePanelActions = computed(() => [
  { id: 'threads', label: t('chat.thread_inbox'), icon: MessageSquareText, panel: 'threads' as const },
  { id: 'settings', label: t('chat.notification_settings'), icon: Bell, panel: 'settings' as const },
  { id: 'pinned', label: t('chat.pinned_messages'), icon: Pin, panel: 'pinned' as const },
  { id: 'members', label: t('chat.member_list'), icon: Users, panel: 'members' as const },
])

const isCompactHeader = computed(() => Boolean(store.activeSidePanel || store.activeThreadId))

function toggleStarred() {
  showMore.value = false
  store.toggleSidePanel('starred')
}

function openDisappearing() {
  showMore.value = false
  showDisappearing.value = !showDisappearing.value
}

function selectTab(tab: ChatContentTab) {
  emit('update:activeTab', tab)
}

function toggleSidePanelFromMenu(panel: SidePanelType) {
  showMore.value = false
  store.toggleSidePanel(panel)
}
</script>

<template>
  <div v-if="room" class="shrink-0 border-b border-border bg-background/95 backdrop-blur-xl">
    <!-- Header row -->
    <div class="flex h-12 min-w-0 items-center gap-2 px-3 sm:px-4">
      <!-- Left: channel icon + name + topic -->
      <div data-testid="chat-header-title" class="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <AtSign v-if="isDirect" :size="20" class="text-muted-foreground shrink-0" />
        <Lock v-else-if="isEncrypted" :size="20" class="text-success shrink-0" />
        <Hash v-else :size="20" class="text-muted-foreground shrink-0" />
        <span data-testid="chat-header-room-name" class="min-w-0 truncate font-semibold text-[15px] text-foreground">{{ room.name }}</span>
        <template v-if="roomTopic">
          <div
            class="mx-1.5 hidden h-4 w-px shrink-0 bg-border/60"
            :class="!isCompactHeader && 'sm:block'"
          />
          <span
            class="hidden min-w-0 truncate text-xs text-muted-foreground"
            :class="!isCompactHeader && 'sm:block'"
            :title="roomTopic"
          >{{ roomTopic }}</span>
        </template>
      </div>

      <!-- Right: action buttons -->
      <div class="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <button
          v-for="action in sidePanelActions"
          :key="action.id"
          class="cursor-pointer items-center justify-center rounded-[var(--radius)] p-1.5 text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground"
          :title="action.label"
          :data-testid="`chat-header-action-${action.id}`"
          :class="[
            isCompactHeader ? 'hidden' : 'hidden sm:flex',
            store.activeSidePanel === action.panel && 'bg-accent text-foreground',
          ]"
          @click="store.toggleSidePanel(action.panel)"
        >
          <component :is="action.icon" :size="18" />
        </button>
        <button
          type="button"
          class="header-search-btn group flex cursor-pointer items-center rounded-[var(--radius)] text-muted-foreground transition-all duration-150"
          :title="t('chat.search_messages')"
          @click="store.toggleSidePanel('search')"
        >
          <div
            data-testid="chat-header-search-control"
            class="flex items-center gap-1.5 rounded-[var(--radius)] bg-input text-xs text-muted-foreground transition-colors group-hover:bg-[color-mix(in_srgb,var(--color-input)_70%,var(--color-accent))] group-hover:text-foreground"
            :class="[
              isCompactHeader ? 'size-8 justify-center' : 'size-8 justify-center sm:w-[140px] sm:justify-start sm:px-2 sm:py-1.5',
              store.activeSidePanel === 'search' && 'bg-accent text-foreground',
            ]"
          >
            <Search :size="14" class="shrink-0" />
            <span
              class="hidden truncate"
              :class="!isCompactHeader && 'sm:inline'"
            >{{ t('common.search') }}</span>
          </div>
        </button>

        <div class="relative">
          <button
            class="flex cursor-pointer items-center justify-center rounded-[var(--radius)] p-1.5 text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground"
            :title="t('chat.more_actions')"
            data-testid="chat-header-more-button"
            aria-haspopup="menu"
            :aria-expanded="showMore"
            @click="showMore = !showMore"
          >
            <MoreHorizontal :size="18" />
          </button>

          <div
            v-if="showMore"
            role="menu"
            class="absolute right-0 top-full z-30 mt-1 min-w-[170px] rounded-md bg-popover p-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          >
            <button
              v-for="action in sidePanelActions"
              :key="`compact-${action.id}`"
              role="menuitem"
              class="flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-accent-foreground"
              :data-testid="`chat-header-menu-${action.id}`"
              :class="[
                !isCompactHeader && 'sm:hidden',
                store.activeSidePanel === action.panel && 'bg-accent text-foreground',
              ]"
              @click="toggleSidePanelFromMenu(action.panel)"
            >
              <component :is="action.icon" :size="14" />
              <span>{{ action.label }}</span>
            </button>
            <div
              class="my-1 h-px bg-border/60"
              :class="!isCompactHeader && 'sm:hidden'"
            />
            <button role="menuitem" class="flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-accent-foreground" @click="toggleStarred">
              <Star :size="14" />
              <span>{{ t('chat.starred_messages') }}</span>
            </button>
            <button role="menuitem" class="flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-accent-foreground" @click="openDisappearing">
              <Timer :size="14" />
              <span>{{ t('chat.disappearing_messages') }}</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="showMore" class="fixed inset-0 z-20" @click="showMore = false" />
    </div>

    <div class="flex h-8 items-center gap-1 overflow-x-auto border-t border-border/35 px-3 [scrollbar-width:none] [-ms-overflow-style:none] sm:px-4 [&::-webkit-scrollbar]:hidden">
      <button
        v-for="tab in contentTabs"
        :key="tab.id"
        type="button"
        class="flex h-7 shrink-0 select-none items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :class="props.activeTab === tab.id
          ? 'bg-primary/12 text-primary shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-primary)_24%,transparent)]'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'"
        :data-testid="`chat-tab-${tab.id}`"
        :aria-pressed="props.activeTab === tab.id"
        @click="selectTab(tab.id)"
      >
        <component :is="tab.icon" :size="14" class="shrink-0" />
        <span>{{ tab.label }}</span>
      </button>
      <button
        type="button"
        class="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground"
        :title="t('chat.tab_add')"
      >
        <Plus :size="14" />
      </button>
    </div>

    <DisappearingMessageSettings
      v-if="showDisappearing && currentRoomId"
      :room-id="currentRoomId"
      @close="showDisappearing = false"
    />
  </div>
</template>

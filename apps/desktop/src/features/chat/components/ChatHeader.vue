<script setup lang="ts">
import type { CallMode } from '@matrix/index';
import type { SidePanelType } from '../stores/chatStore';
import { getRoomTopic } from '@matrix/rooms';
import { getDirectRoomPeer, isDirectRoom } from '@matrix/roomUtils';
import {
  AtSign,
  Bell,
  Brain,
  FileText,
  FolderOpen,
  Hash,
  ListTodo,
  Lock,
  MessageSquareText,
  MoreHorizontal,
  Phone,
  Pin,
  Plus,
  Search,
  Star,
  Timer,
  Users,
  Video,
} from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCallStore } from '@/features/calls/stores/callStore';
import { useCurrentRoom } from '../composables/useCurrentRoom';
import { useChatStore } from '../stores/chatStore';
import DisappearingMessageSettings from './DisappearingMessageSettings.vue';

type ChatContentTab = 'chat' | 'docs' | 'files';

const props = withDefaults(
  defineProps<{
    activeTab?: ChatContentTab;
  }>(),
  {
    activeTab: 'chat',
  },
);

const emit = defineEmits<{
  'update:activeTab': [tab: ChatContentTab];
}>();

const { room, currentRoomId } = useCurrentRoom();
const store = useChatStore();
const callStore = useCallStore();
const { t } = useI18n();
const showDisappearing = ref(false);
const showMore = ref(false);
const showAddTabMenu = ref(false);

const roomPreview = computed(() =>
  currentRoomId.value ? store.getSidebarPromotionPreview(currentRoomId.value) : undefined,
);

const hasHeaderInfo = computed(() => !!room.value || !!roomPreview.value);

const roomName = computed(() => room.value?.name || roomPreview.value?.name || '');

const isDirect = computed(() => {
  if (room.value && currentRoomId.value) return isDirectRoom(currentRoomId.value);
  return roomPreview.value?.isDirect ?? false;
});

const isEncrypted = computed(() => {
  return room.value?.hasEncryptionStateEvent() ?? roomPreview.value?.isEncrypted ?? false;
});

/** 频道话题，截断显示在频道名后方 */
const roomTopic = computed(() => {
  if (!currentRoomId.value || !room.value) return '';
  return getRoomTopic(currentRoomId.value);
});

const contentTabs = computed(() => [
  { id: 'chat' as const, label: t('chat.tab_chat'), icon: MessageSquareText },
  { id: 'docs' as const, label: t('chat.tab_docs'), icon: FileText },
  { id: 'files' as const, label: t('chat.tab_file'), icon: FolderOpen },
]);

const sidePanelActions = computed(() => [
  { id: 'threads', label: t('chat.thread_inbox'), icon: MessageSquareText, panel: 'threads' as const },
  { id: 'settings', label: t('chat.notification_settings'), icon: Bell, panel: 'settings' as const },
  { id: 'pinned', label: t('chat.pinned_messages'), icon: Pin, panel: 'pinned' as const },
  { id: 'members', label: t('chat.member_list'), icon: Users, panel: 'members' as const },
]);

const extendedTabActions = computed(() => [
  { id: 'tasks', label: t('chat.tasks'), icon: ListTodo, panel: 'tasks' as const },
  { id: 'knowledge', label: t('chat.knowledge'), icon: Brain, panel: 'knowledge' as const },
]);

const isCompactHeader = computed(() => Boolean(store.activeSidePanel || store.activeThreadId));

function toggleStarred() {
  showMore.value = false;
  showAddTabMenu.value = false;
  store.toggleSidePanel('starred');
}

function openDisappearing() {
  showMore.value = false;
  showAddTabMenu.value = false;
  showDisappearing.value = !showDisappearing.value;
}

function selectTab(tab: ChatContentTab) {
  emit('update:activeTab', tab);
}

function toggleSidePanelFromMenu(panel: SidePanelType) {
  showMore.value = false;
  showAddTabMenu.value = false;
  store.toggleSidePanel(panel);
}

function toggleMoreMenu() {
  showAddTabMenu.value = false;
  showMore.value = !showMore.value;
}

function toggleAddTabMenu() {
  showMore.value = false;
  showAddTabMenu.value = !showAddTabMenu.value;
}

function openExtendedTab(panel: SidePanelType) {
  showAddTabMenu.value = false;
  store.toggleSidePanel(panel);
}

function startDirectCall(mode: CallMode) {
  if (!currentRoomId.value || callStore.isActive) return;
  const peer = getDirectRoomPeer(currentRoomId.value);
  if (!peer) return;
  void callStore.startCall(currentRoomId.value, peer.userId, peer.displayName, mode);
}
</script>

<template>
  <div v-if="hasHeaderInfo" class="shrink-0 border-b border-border bg-sidebar">
    <div class="flex h-14 min-w-0 items-center gap-2 px-4">
      <div data-testid="chat-header-title" class="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <AtSign v-if="isDirect" :size="20" class="text-muted-foreground shrink-0" />
        <Lock v-else-if="isEncrypted" :size="20" class="text-success shrink-0" />
        <Hash v-else :size="20" class="text-muted-foreground shrink-0" />
        <span data-testid="chat-header-room-name" class="min-w-0 truncate text-[16px] font-semibold text-foreground">{{
          roomName
        }}</span>
        <template v-if="roomTopic">
          <div class="mx-1.5 h-4 w-px shrink-0 bg-border/60" />
          <span class="min-w-0 truncate text-xs text-muted-foreground" :title="roomTopic">{{ roomTopic }}</span>
        </template>
      </div>

      <div class="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <template v-if="isDirect">
          <button
            type="button"
            class="flex cursor-pointer items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            :title="t('calls.audio_call_label')"
            data-testid="chat-header-call-audio"
            :disabled="callStore.isActive"
            @click="startDirectCall('audio')"
          >
            <Phone :size="18" />
          </button>
          <button
            type="button"
            class="flex cursor-pointer items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            :title="t('calls.video_call_label')"
            data-testid="chat-header-call-video"
            :disabled="callStore.isActive"
            @click="startDirectCall('video')"
          >
            <Video :size="18" />
          </button>
        </template>
        <button
          v-for="action in sidePanelActions"
          :key="action.id"
          class="cursor-pointer items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
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
          class="header-search-btn group flex cursor-pointer items-center rounded-md text-muted-foreground transition-colors duration-150"
          :title="t('chat.search_messages')"
          @click="store.toggleSidePanel('search')"
        >
          <div
            data-testid="chat-header-search-control"
            class="flex items-center gap-1.5 rounded-md border border-border bg-input text-xs text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-foreground"
            :class="[
              isCompactHeader
                ? 'size-8 justify-center'
                : 'size-8 justify-center sm:w-[140px] sm:justify-start sm:px-2 sm:py-1.5',
              store.activeSidePanel === 'search' && 'bg-accent text-foreground',
            ]"
          >
            <Search :size="14" class="shrink-0" />
            <span class="hidden truncate" :class="!isCompactHeader && 'sm:inline'">{{ t('common.search') }}</span>
          </div>
        </button>

        <div class="relative">
          <button
            class="flex cursor-pointer items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
            :title="t('chat.more_actions')"
            data-testid="chat-header-more-button"
            aria-haspopup="menu"
            :aria-expanded="showMore"
            @click="toggleMoreMenu"
          >
            <MoreHorizontal :size="18" />
          </button>

          <div v-if="showMore" role="menu" class="workspace-menu absolute right-0 top-full z-30 mt-1 min-w-[170px]">
            <button
              v-for="action in sidePanelActions"
              :key="`compact-${action.id}`"
              role="menuitem"
              class="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition-colors duration-[120ms] hover:bg-accent hover:text-accent-foreground"
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
            <div class="my-1 h-px bg-border/60" :class="!isCompactHeader && 'sm:hidden'" />
            <button
              role="menuitem"
              class="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition-colors duration-[120ms] hover:bg-accent hover:text-accent-foreground"
              @click="toggleStarred"
            >
              <Star :size="14" />
              <span>{{ t('chat.starred_messages') }}</span>
            </button>
            <button
              role="menuitem"
              class="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition-colors duration-[120ms] hover:bg-accent hover:text-accent-foreground"
              @click="openDisappearing"
            >
              <Timer :size="14" />
              <span>{{ t('chat.disappearing_messages') }}</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="showMore" class="fixed inset-0 z-20" @click="showMore = false" />
    </div>

    <div class="relative border-t border-border">
      <div class="muon-scrollbar-hidden flex h-9 items-center gap-1 overflow-x-auto px-4">
        <button
          v-for="tab in contentTabs"
          :key="tab.id"
          type="button"
          class="flex h-7 shrink-0 select-none items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="
            props.activeTab === tab.id
              ? 'bg-accent text-primary shadow-[inset_2px_0_0_var(--color-primary)]'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          "
          :data-testid="`chat-tab-${tab.id}`"
          :aria-pressed="props.activeTab === tab.id"
          @click="selectTab(tab.id)"
        >
          <component :is="tab.icon" :size="14" class="shrink-0" />
          <span>{{ tab.label }}</span>
        </button>
        <button
          type="button"
          class="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
          :title="t('chat.tab_add')"
          data-testid="chat-tab-add-button"
          aria-haspopup="menu"
          :aria-expanded="showAddTabMenu"
          @click="toggleAddTabMenu"
        >
          <Plus :size="14" />
        </button>
      </div>
      <div
        v-if="showAddTabMenu"
        data-testid="chat-tab-add-menu"
        role="menu"
        class="workspace-menu absolute left-4 top-[calc(100%+2px)] z-30 min-w-[156px]"
      >
        <button
          v-for="action in extendedTabActions"
          :key="action.id"
          role="menuitem"
          class="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition-colors duration-[120ms] hover:bg-accent hover:text-accent-foreground"
          :class="store.activeSidePanel === action.panel && 'bg-accent text-foreground'"
          :data-testid="`chat-tab-add-${action.id}`"
          @click="openExtendedTab(action.panel)"
        >
          <component :is="action.icon" :size="14" />
          <span>{{ action.label }}</span>
        </button>
      </div>
    </div>
    <div v-if="showAddTabMenu" class="fixed inset-0 z-20" @click="showAddTabMenu = false" />

    <DisappearingMessageSettings
      v-if="showDisappearing && currentRoomId"
      :room-id="currentRoomId"
      @close="showDisappearing = false"
    />
  </div>
</template>

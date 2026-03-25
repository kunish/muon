<script setup lang="ts">
import { getClient } from '@matrix/client'
import { getMyAvatarUrl, getMyDisplayName, loadInboxEventContext } from '@matrix/index'
import { BookOpen, CalendarDays, ChevronDown, Gem, Headphones, ListChecks, Mic, MicOff, Search, Settings, Users, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import ConversationContextMenu from '@/features/chat/components/ConversationContextMenu.vue'
import DeferQueuePanel from '@/features/chat/components/DeferQueuePanel.vue'
import UnifiedInboxPanel from '@/features/chat/components/UnifiedInboxPanel.vue'
import { useConversations } from '@/features/chat/composables/useConversations'
import { useChatStore } from '@/features/chat/stores/chatStore'
import { useVoiceChannel } from '@/features/server/composables/useVoiceChannel'
import { useServerStore } from '@/features/server/stores/serverStore'
import { Avatar } from '@/shared/components/ui/avatar'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { normalizeRoomId } from '@/shared/lib/roomUtils'
import ChannelCategory from './ChannelCategory.vue'
import ChannelContextMenu from './ChannelContextMenu.vue'
import CreateChannelDialog from './CreateChannelDialog.vue'
import ServerDropdown from './ServerDropdown.vue'
import TextChannelItem from './TextChannelItem.vue'
import VoiceChannelItem from './VoiceChannelItem.vue'
import VoiceStatusBar from './VoiceStatusBar.vue'

const emit = defineEmits<{
  createCategory: []
  invitePeople: []
  serverSettings: []
  notificationSettings: []
  leaveServer: []
}>()

const router = useRouter()
const route = useRoute()
const serverStore = useServerStore()
const chatStore = useChatStore()
const { t } = useI18n()

// DM mode data
const { conversations } = useConversations()
const dmSearch = ref('')

const dmList = computed(() => {
  let list = conversations.value.filter(r => r.isDirect)
  const q = dmSearch.value.toLowerCase().trim()
  if (q) {
    list = list.filter(r => r.name.toLowerCase().includes(q))
  }
  return list
})

// Server mode data
const channelTree = computed(() => serverStore.channelTree)
const isDmMode = computed(() => serverStore.isDmMode)
const currentServer = computed(() => {
  if (!serverStore.currentServerId)
    return null
  return serverStore.servers.find(s => s.spaceId === serverStore.currentServerId) ?? null
})

// Create channel dialog
const showCreateChannel = ref(false)
const createChannelCategoryId = ref<string | undefined>(undefined)

function openCreateChannel(categoryId?: string) {
  createChannelCategoryId.value = categoryId
  showCreateChannel.value = true
}

// DM navigation
function navigateToDm(roomId: string) {
  router.push(`/dm/${encodeURIComponent(roomId)}`)
}

function openDmContextMenu(roomId: string, event: MouseEvent) {
  chatStore.openContextMenu(roomId, event.clientX, event.clientY)
}

const activeDmRoomId = computed(() =>
  normalizeRoomId((route.params.roomId || route.params.channelId) as string | undefined) ?? normalizeRoomId(chatStore.currentRoomId),
)

async function handleInboxJump(payload: { roomId: string, eventId: string }) {
  try {
    await loadInboxEventContext(payload.roomId, payload.eventId)
  }
  catch (error) {
    console.warn('[UnifiedInbox] context preload failed, fallback to direct navigation', error)
  }

  await router.push({
    path: `/dm/${encodeURIComponent(payload.roomId)}`,
    query: {
      focusEventId: payload.eventId,
    },
  })
}

function navigateToFriends() {
  router.push('/contacts')
}

function openTasksPanel() {
  chatStore.toggleSidePanel('tasks')
}

function openKnowledgePanel() {
  chatStore.toggleSidePanel('knowledge')
}

function openEvents() {
  router.push('/calendar')
}

function openServerBoosts() {
  emit('serverSettings')
}

// ── Current user info ──
const currentUser = computed(() => {
  const client = getClient()
  const userId = client.getUserId()
  return {
    displayName: getMyDisplayName(),
    mxcAvatar: getMyAvatarUrl(),
    userId: userId || '',
  }
})

// ── User panel mic / headphone state ──
const {
  isMuted,
  isDeafened,
  toggleMute,
  toggleDeafen,
} = useVoiceChannel()

function openSettings() {
  router.push('/settings')
}

function getPresenceColor(userId: string): string {
  const presence = getClient().getUser(userId)?.presence
  if (presence === 'online')
    return 'bg-success'
  if (presence === 'unavailable')
    return 'bg-warning'
  return 'bg-muted-foreground/40'
}
</script>

<template>
  <aside class="flex h-full min-h-0 w-[280px] shrink-0 flex-col bg-sidebar">
    <!-- ═══════════════ DM MODE ═══════════════ -->
    <template v-if="isDmMode">
      <ScrollArea class="min-h-0 flex-1">
        <!-- Search bar -->
        <div class="p-2">
          <div class="relative">
            <Search :size="14" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              v-model="dmSearch"
              :placeholder="t('chat.search_conversations')"
              class="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <!-- Friends shortcut -->
        <button
          class="mx-2 flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
          @click="navigateToFriends"
        >
          <Users :size="20" />
          {{ t('server.friends') }}
        </button>
        <button
          class="mx-2 mt-1 flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
          data-testid="tasks-panel-trigger"
          @click="openTasksPanel"
        >
          <ListChecks :size="20" />
          {{ t('chat.tasks') }}
        </button>
        <button
          class="mx-2 mt-1 flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
          :class="chatStore.activeSidePanel === 'knowledge' && 'bg-accent/30 text-foreground'"
          data-testid="knowledge-panel-trigger"
          :aria-pressed="chatStore.activeSidePanel === 'knowledge'"
          @click="openKnowledgePanel"
        >
          <BookOpen :size="20" />
          {{ t('chat.knowledge') }}
        </button>

        <div class="px-4 py-2">
          <span class="text-xs font-medium tracking-normal text-muted-foreground">
            {{ t('server.direct_messages') }}
          </span>
        </div>

        <div class="min-h-0">
          <UnifiedInboxPanel @jump="handleInboxJump" />
          <DeferQueuePanel />
        </div>

        <div class="space-y-px px-2 pb-2">
          <button
            v-for="dm in dmList"
            :key="dm.roomId"
            class="group relative flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/30"
            :class="normalizeRoomId(dm.roomId) === activeDmRoomId && 'bg-primary/18 shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-primary)_42%,transparent)]'"
            @click="navigateToDm(dm.roomId)"
            @contextmenu.prevent="openDmContextMenu(dm.roomId, $event)"
          >
            <span
              v-if="normalizeRoomId(dm.roomId) === activeDmRoomId"
              class="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-[4px] rounded-r-full bg-primary"
            />
            <div class="relative">
              <Avatar
                :src="dm.dmUserAvatar"
                :alt="dm.name"
                :color-id="dm.dmUserId || dm.roomId"
                size="sm"
              />
              <!-- Online indicator -->
              <div class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-sidebar" :class="getPresenceColor(dm.dmUserId || '')" />
            </div>
            <span
              class="truncate group-hover:text-foreground"
              :class="normalizeRoomId(dm.roomId) === activeDmRoomId ? 'text-foreground font-medium' : 'text-muted-foreground'"
            >{{ dm.name }}</span>
            <Badge
              v-if="dm.unreadCount > 0"
              variant="destructive"
              class="ml-auto h-4 min-w-4 px-1 text-[10px] leading-none"
            >
              {{ dm.unreadCount > 99 ? '99+' : dm.unreadCount }}
            </Badge>
          </button>

          <div v-if="dmList.length === 0" class="px-2 py-4 text-center text-xs text-muted-foreground">
            {{ t('chat.no_conversations') }}
          </div>
        </div>
        <ConversationContextMenu />
      </ScrollArea>
    </template>

    <!-- ═══════════════ SERVER MODE ═══════════════ -->
    <template v-else-if="currentServer">
      <!-- Server header with dropdown -->
      <ServerDropdown
        @create-channel="openCreateChannel()"
        @create-category="$emit('createCategory')"
        @invite-people="$emit('invitePeople')"
        @server-settings="$emit('serverSettings')"
        @notification-settings="$emit('notificationSettings')"
        @leave-server="$emit('leaveServer')"
      >
        <template #trigger="{ open }">
          <button
            class="flex w-full items-center justify-between border-b border-border px-4 py-3 font-semibold text-foreground shadow-sm transition-colors hover:bg-accent/50"
            :class="open && 'bg-accent/50'"
          >
            <span class="truncate">{{ currentServer.name }}</span>
            <component :is="open ? X : ChevronDown" :size="16" class="shrink-0 text-muted-foreground" />
          </button>
        </template>
      </ServerDropdown>

      <!-- Server quick entry panel -->
      <div
        v-if="channelTree.length <= 2"
        class="border-b border-border px-3 py-3"
      >
        <div class="rounded-lg border border-border/70 bg-card/70 p-3">
          <div class="mb-2 flex items-center justify-center">
            <Avatar
              :src="currentServer.avatar"
              :alt="currentServer.name"
              :color-id="currentServer.spaceId"
              size="xl"
            />
          </div>
          <p class="text-center text-sm font-medium text-foreground/90">
            {{ t('server.welcome_intro') }}
          </p>
          <button
            class="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            @click="$emit('invitePeople')"
          >
            {{ t('server.invite_people') }}
          </button>
        </div>
      </div>

      <div class="border-b border-border px-2 py-2">
        <button
          class="group flex w-full items-center gap-2 rounded px-2 py-[5px] text-[15px] text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
          @click="openEvents"
        >
          <CalendarDays :size="18" class="shrink-0 opacity-70" />
          <span class="truncate">{{ t('server.events') }}</span>
        </button>
        <button
          class="group flex w-full items-center gap-2 rounded px-2 py-[5px] text-[15px] text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
          @click="openServerBoosts"
        >
          <Gem :size="18" class="shrink-0 opacity-70" />
          <span class="truncate">{{ t('server.server_boosts') }}</span>
        </button>
      </div>

      <!-- Channel tree -->
      <ScrollArea class="min-h-0 flex-1">
        <div class="px-2 pb-2">
          <ChannelCategory
            v-for="category in channelTree"
            :key="category.id"
            :category="category"
            @create-channel="openCreateChannel($event)"
          >
            <template v-for="channel in category.channels" :key="channel.roomId">
              <ChannelContextMenu :channel="channel">
                <TextChannelItem
                  v-if="!channel.isVoice"
                  :channel="channel"
                />
                <VoiceChannelItem
                  v-else
                  :channel="channel"
                />
              </ChannelContextMenu>
            </template>
          </ChannelCategory>
        </div>
      </ScrollArea>
    </template>

    <!-- ═══════════════ VOICE STATUS BAR ═══════════════ -->
    <VoiceStatusBar />

    <!-- ═══════════════ USER INFO PANEL ═══════════════ -->
    <div class="user-panel flex shrink-0 items-center gap-2 border-t border-border bg-popover px-2 py-2">
      <!-- Avatar + name block -->
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <Avatar
          :src="currentUser.mxcAvatar"
          :alt="currentUser.displayName"
          :color-id="currentUser.userId"
          size="sm"
        />
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold leading-tight text-foreground">
            {{ currentUser.displayName }}
          </div>
          <div class="truncate text-[11px] leading-tight text-muted-foreground">
            {{ currentUser.userId }}
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="flex shrink-0 items-center gap-0.5">
        <button
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-all duration-100 hover:bg-accent hover:text-foreground active:scale-95"
          :class="isMuted ? 'text-destructive hover:bg-[color-mix(in_srgb,var(--color-destructive)_12%,transparent)] hover:text-destructive' : ''"
          :title="isMuted ? t('voice.unmute') : t('voice.mute')"
          @click="toggleMute"
        >
          <MicOff v-if="isMuted" :size="16" />
          <Mic v-else :size="16" />
        </button>
        <button
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-all duration-100 hover:bg-accent hover:text-foreground active:scale-95"
          :class="isDeafened ? 'text-destructive hover:bg-[color-mix(in_srgb,var(--color-destructive)_12%,transparent)] hover:text-destructive' : ''"
          :title="isDeafened ? t('voice.undeafen') : t('voice.deafen')"
          @click="toggleDeafen"
        >
          <Headphones :size="16" />
        </button>
        <button
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-all duration-100 hover:bg-accent hover:text-foreground active:scale-95"
          :title="t('settings.settings')"
          @click="openSettings"
        >
          <Settings :size="16" />
        </button>
      </div>
    </div>

    <!-- Create Channel Dialog -->
    <CreateChannelDialog
      v-model:open="showCreateChannel"
      :category-id="createChannelCategoryId"
    />
  </aside>
</template>

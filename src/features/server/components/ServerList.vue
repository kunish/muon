<script setup lang="ts">
import { Compass, Gamepad2, Plus } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useConversations } from '@/features/chat/composables/useConversations'
import { useServerStore } from '@/features/server/stores/serverStore'
import Tooltip from '@/shared/components/ui/tooltip.vue'
import CreateServerDialog from './CreateServerDialog.vue'
import ServerIcon from './ServerIcon.vue'

const router = useRouter()
const serverStore = useServerStore()
const { conversations } = useConversations()
const { t } = useI18n()

const servers = computed(() => serverStore.servers)
const currentServerId = computed(() => serverStore.currentServerId)
const isDmMode = computed(() => serverStore.isDmMode)

const homeUnread = computed(() =>
  conversations.value
    .filter(r => r.isDirect)
    .reduce((sum, r) => sum + r.unreadCount, 0),
)

const homeHighlight = computed(() =>
  conversations.value
    .filter(r => r.isDirect)
    .reduce((sum, r) => sum + r.highlightCount, 0),
)

function homePillClass(): string {
  if (isDmMode.value)
    return 'h-10'
  if (homeHighlight.value > 0)
    return 'h-3'
  if (homeUnread.value > 0)
    return 'h-2'
  return 'h-0 group-hover:h-2'
}

function serverPillClass(serverId: string): string {
  if (currentServerId.value === serverId)
    return 'h-10'
  const info = serverStore.getServerUnreadInfo(serverId)
  if (info.highlightCount > 0)
    return 'h-3'
  if (info.unreadCount > 0)
    return 'h-2'
  return 'h-0 group-hover:h-2'
}

function selectHome() {
  serverStore.selectServer(null)
  router.push('/dm')
}

function selectServer(serverId: string) {
  serverStore.selectServer(serverId)
  const channelId = serverStore.currentChannelId
  if (channelId) {
    router.push(`/server/${encodeURIComponent(serverId)}/channel/${encodeURIComponent(channelId)}`)
  }
}

// --- Drag and drop ---
let dragIndex: number | null = null

function onDragStart(index: number) {
  dragIndex = index
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
}

function onDrop(targetIndex: number) {
  if (dragIndex !== null && dragIndex !== targetIndex) {
    serverStore.reorderServer(dragIndex, targetIndex)
  }
  dragIndex = null
}
</script>

<template>
  <nav class="flex flex-col items-center w-[72px] bg-server-bar py-3 gap-2 overflow-y-auto scrollbar-hide shrink-0">
    <!-- Home / DM Button -->
    <Tooltip :content="t('server.direct_messages')" side="right">
      <button
        class="server-icon-wrapper group"
        :class="{ 'is-active': isDmMode }"
        @click="selectHome"
      >
        <div
          class="server-icon bg-background text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-150"
          :class="isDmMode ? 'rounded-2xl bg-primary text-primary-foreground' : 'rounded-3xl'"
        >
          <Gamepad2 :size="23" />
        </div>
        <!-- Pill indicator -->
        <div
          class="pill"
          :class="homePillClass()"
        />

        <div
          v-if="homeHighlight > 0"
          class="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[11px] font-bold rounded-full flex items-center justify-center px-1"
        >
          {{ homeHighlight > 99 ? '99+' : homeHighlight }}
        </div>
      </button>
    </Tooltip>

    <!-- Separator -->
    <div class="w-8 h-0.5 bg-border rounded-full mx-auto" />

    <!-- Server Icons -->
    <Tooltip
      v-for="(server, index) in servers"
      :key="server.spaceId"
      :content="server.name"
      side="right"
    >
      <div
        class="server-icon-wrapper group"
        :class="{ 'is-active': currentServerId === server.spaceId }"
        draggable="true"
        @dragstart="onDragStart(index)"
        @dragover="onDragOver"
        @drop="onDrop(index)"
        @click="selectServer(server.spaceId)"
      >
        <ServerIcon
          :name="server.name"
          :avatar="server.avatar"
          :is-selected="currentServerId === server.spaceId"
          :space-id="server.spaceId"
        />
        <!-- Pill indicator -->
        <div
          class="pill"
          :class="serverPillClass(server.spaceId)"
        />
      </div>
    </Tooltip>

    <!-- Separator -->
    <div class="w-8 h-0.5 bg-border rounded-full mx-auto" />

    <!-- Add Server Button -->
    <CreateServerDialog>
      <template #trigger>
        <Tooltip :content="t('server.create_server')" side="right">
          <button class="server-icon-wrapper group">
            <div class="server-icon rounded-3xl bg-background text-success group-hover:bg-success group-hover:text-white group-hover:rounded-2xl transition-all duration-150">
              <Plus :size="24" />
            </div>
          </button>
        </Tooltip>
      </template>
    </CreateServerDialog>

    <!-- Explore Servers -->
    <Tooltip :content="t('server.friends')" side="right">
      <button class="server-icon-wrapper group" @click="router.push('/contacts')">
        <div class="server-icon rounded-3xl bg-background text-success group-hover:bg-success group-hover:text-white group-hover:rounded-2xl transition-all duration-150">
          <Compass :size="20" />
        </div>
      </button>
    </Tooltip>
  </nav>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.server-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.server-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 18px;
  font-weight: 600;
}

.pill {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  border-radius: 0 4px 4px 0;
  background: var(--color-foreground);
  transition: height 150ms ease;
}

.is-active .pill {
  height: 40px;
}
</style>

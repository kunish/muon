<script setup lang="ts">
import { Compass, MessageCircle, Plus } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useConversations } from '@/features/chat/composables/useConversations'
import { useServerStore } from '@/features/server/stores/serverStore'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip'
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

function homeIndicatorClass(): string {
  if (isDmMode.value)
    return 'w-5 opacity-100'
  if (homeHighlight.value > 0)
    return 'w-2.5 opacity-100'
  if (homeUnread.value > 0)
    return 'w-1.5 opacity-100'
  return 'w-0 opacity-0 group-hover:w-1.5 group-hover:opacity-100'
}

function serverIndicatorClass(serverId: string): string {
  if (currentServerId.value === serverId)
    return 'w-5 opacity-100'
  const info = serverStore.getServerUnreadInfo(serverId)
  if (info.highlightCount > 0)
    return 'w-2.5 opacity-100'
  if (info.unreadCount > 0)
    return 'w-1.5 opacity-100'
  return 'w-0 opacity-0 group-hover:w-1.5 group-hover:opacity-100'
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
  <TooltipProvider>
    <nav class="flex shrink-0 flex-col items-center gap-1.5 overflow-y-auto bg-server-bar py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden w-[52px]">
      <!-- Home / DM Button -->
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            class="group relative flex cursor-pointer flex-col items-center justify-center gap-[3px]"
            :class="{ 'is-active': isDmMode }"
            @click="selectHome"
          >
            <div
              class="flex size-9 items-center justify-center overflow-hidden bg-background text-[15px] font-semibold text-foreground transition-all duration-150 group-hover:bg-primary group-hover:text-primary-foreground"
              :class="isDmMode ? 'rounded-2xl bg-primary text-primary-foreground' : 'rounded-3xl'"
            >
              <MessageCircle :size="23" />
            </div>
            <!-- Indicator -->
            <div
              class="h-[3px] rounded-full bg-primary transition-all duration-150 ease-out"
              :class="homeIndicatorClass()"
            />

            <div
              v-if="homeHighlight > 0"
              class="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[11px] font-bold rounded-full flex items-center justify-center px-1"
            >
              {{ homeHighlight > 99 ? '99+' : homeHighlight }}
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {{ t('server.direct_messages') }}
        </TooltipContent>
      </Tooltip>

      <!-- Separator -->
      <div class="w-6 h-px bg-border rounded-full mx-auto" />

      <!-- Server Icons -->
      <Tooltip
        v-for="(server, index) in servers"
        :key="server.spaceId"
      >
        <TooltipTrigger as-child>
          <div
            class="group relative flex cursor-pointer flex-col items-center justify-center gap-[3px]"
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
            <!-- Indicator -->
            <div
              class="h-[3px] rounded-full bg-primary transition-all duration-150 ease-out"
              :class="serverIndicatorClass(server.spaceId)"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          {{ server.name }}
        </TooltipContent>
      </Tooltip>

      <!-- Separator -->
      <div class="w-6 h-px bg-border rounded-full mx-auto" />

      <!-- Add Server Button -->
      <CreateServerDialog>
        <template #trigger>
          <Tooltip>
            <TooltipTrigger as-child>
              <button class="group relative flex cursor-pointer flex-col items-center justify-center gap-[3px]">
                <div class="flex size-9 items-center justify-center overflow-hidden rounded-xl bg-background text-[15px] font-semibold text-muted-foreground transition-all duration-150 hover:bg-primary/10 hover:text-primary">
                  <Plus :size="20" />
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {{ t('server.create_server') }}
            </TooltipContent>
          </Tooltip>
        </template>
      </CreateServerDialog>

      <!-- Explore Servers -->
      <Tooltip>
        <TooltipTrigger as-child>
          <button class="group relative flex cursor-pointer flex-col items-center justify-center gap-[3px]" @click="router.push('/contacts')">
            <div class="flex size-9 items-center justify-center overflow-hidden rounded-xl bg-background text-[15px] font-semibold text-muted-foreground transition-all duration-150 hover:bg-primary/10 hover:text-primary">
              <Compass :size="18" />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {{ t('server.friends') }}
        </TooltipContent>
      </Tooltip>
    </nav>
  </TooltipProvider>
</template>

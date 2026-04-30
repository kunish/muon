<script setup lang="ts">
import { ChevronDown, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import WorkspaceResizablePane from '@/app/components/workspace/WorkspaceResizablePane.vue'
import ConversationList from '@/features/chat/components/ConversationList.vue'
import { useServerStore } from '@/features/server/stores/serverStore'
import { Avatar } from '@/shared/components/ui/avatar'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import ChannelCategory from './ChannelCategory.vue'
import ChannelContextMenu from './ChannelContextMenu.vue'
import CreateChannelDialog from './CreateChannelDialog.vue'
import ServerDropdown from './ServerDropdown.vue'
import TextChannelItem from './TextChannelItem.vue'
import UserPanel from './UserPanel.vue'
import VoiceChannelItem from './VoiceChannelItem.vue'
import VoiceStatusBar from './VoiceStatusBar.vue'

defineEmits<{
  createCategory: []
  invitePeople: []
  serverSettings: []
  notificationSettings: []
  leaveServer: []
}>()

const serverStore = useServerStore()
const { t } = useI18n()

const SIDEBAR_WIDTH_STORAGE_KEY = 'muon_message_sidebar_width'
const DEFAULT_SIDEBAR_WIDTH = 240
const MIN_SIDEBAR_WIDTH = 220
const MAX_SIDEBAR_WIDTH = 360

const channelTree = computed(() => serverStore.channelTree)
const isDmMode = computed(() => serverStore.isDmMode)
const currentServer = computed(() => {
  if (!serverStore.currentServerId)
    return null
  return serverStore.servers.find(s => s.spaceId === serverStore.currentServerId) ?? null
})

const showCreateChannel = ref(false)
const createChannelCategoryId = ref<string | undefined>(undefined)
const resizeHandleLabel = computed(() => t('sidebar.resize_messages'))

function openCreateChannel(categoryId?: string): void {
  createChannelCategoryId.value = categoryId
  showCreateChannel.value = true
}
</script>

<template>
  <WorkspaceResizablePane
    as="aside"
    pane-test-id="channel-sidebar"
    content-test-id="channel-sidebar-content"
    handle-test-id="channel-sidebar-resize-handle"
    :width-storage-key="SIDEBAR_WIDTH_STORAGE_KEY"
    :default-width="DEFAULT_SIDEBAR_WIDTH"
    :min-width="MIN_SIDEBAR_WIDTH"
    :max-width="MAX_SIDEBAR_WIDTH"
    :resize-label="resizeHandleLabel"
  >
    <template v-if="isDmMode">
      <ConversationList />
    </template>

    <template v-else-if="currentServer">
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
            class="flex w-full items-center justify-between border-b border-sidebar-border px-4 py-3.5 font-semibold text-foreground transition-colors hover:bg-sidebar-accent"
            :class="open && 'bg-sidebar-accent'"
          >
            <span class="truncate">{{ currentServer.name }}</span>
            <component :is="open ? X : ChevronDown" :size="16" class="shrink-0 text-muted-foreground" />
          </button>
        </template>
      </ServerDropdown>

      <div
        v-if="channelTree.length <= 2"
        class="border-b border-sidebar-border px-3 py-3"
      >
        <div class="rounded-lg border border-sidebar-border bg-sidebar-accent p-3">
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
            class="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.98]"
            @click="$emit('invitePeople')"
          >
            {{ t('server.invite_people') }}
          </button>
        </div>
      </div>

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
                <template #default="{ open }">
                  <TextChannelItem
                    v-if="!channel.isVoice"
                    :channel="channel"
                    :context-menu-open="open"
                  />
                  <VoiceChannelItem
                    v-else
                    :channel="channel"
                    :context-menu-open="open"
                  />
                </template>
              </ChannelContextMenu>
            </template>
          </ChannelCategory>
        </div>
      </ScrollArea>
    </template>

    <VoiceStatusBar />

    <UserPanel />

    <CreateChannelDialog
      v-model:open="showCreateChannel"
      :category-id="createChannelCategoryId"
    />
  </WorkspaceResizablePane>
</template>

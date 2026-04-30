<script setup lang="ts">
import { useConversations } from '@features/chat/composables/useConversations'
import ChannelSidebar from '@features/server/components/ChannelSidebar.vue'
import CreateCategoryDialog from '@features/server/components/CreateCategoryDialog.vue'
import InviteDialog from '@features/server/components/InviteDialog.vue'
import ServerSettings from '@features/server/components/ServerSettings.vue'
import { useServerStore } from '@features/server/stores/serverStore'
import { useTheme } from '@features/settings/composables/useTheme'
import { useSettingsStore } from '@features/settings/stores/settingsStore'
import { getClient } from '@matrix/client'
import { Button } from '@shared/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@shared/components/ui/dialog'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import NetworkStatusBar from './NetworkStatusBar.vue'
import WatermarkOverlay from './WatermarkOverlay.vue'
import { getWorkspaceAppForPath } from './workspace/navigation'
import WorkspaceLayout from './workspace/WorkspaceLayout.vue'

const settingsStore = useSettingsStore()
const serverStore = useServerStore()
const { totalUnreadCount } = useConversations()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

useTheme()

const showChannelSidebar = computed(() => {
  return getWorkspaceAppForPath(route.path).id === 'messages'
})

const showServerSettings = ref(false)
const showInviteDialog = ref(false)
const showCreateCategoryDialog = ref(false)
const showLeaveConfirm = ref(false)
const isLeavingServer = ref(false)

function requestLeaveServer(): void {
  if (!serverStore.currentServerId)
    return
  showLeaveConfirm.value = true
}

async function confirmLeaveServer(): Promise<void> {
  const spaceId = serverStore.currentServerId
  if (!spaceId || isLeavingServer.value)
    return

  isLeavingServer.value = true
  try {
    await getClient().leave(spaceId)
    serverStore.selectServer(null)
    showLeaveConfirm.value = false
    router.push('/dm')
  }
  catch (err: unknown) {
    console.error('Failed to leave server:', err)
    toast.error(t('auth.error'))
  }
  finally {
    isLeavingServer.value = false
  }
}

function openNotificationSettings(): void {
  router.push({ path: '/settings', query: { tab: 'notifications' } })
}

function syncServerSelectionFromRoute(): void {
  const serverId = route.params.serverId as string | undefined
  const channelId = route.params.channelId as string | undefined

  if (route.path.startsWith('/server') && serverId) {
    serverStore.selectServer(serverId)
    if (channelId) {
      serverStore.selectChannel(channelId)
    }
    return
  }

  if (route.path.startsWith('/dm')) {
    serverStore.selectServer(null)
  }
}

watch(() => route.fullPath, syncServerSelectionFromRoute)

const watermarkText = computed(() => {
  const date = new Date().toLocaleDateString()
  return `${settingsStore.watermarkEnabled ? 'User' : ''} ${date}`
})

onMounted(() => {
  serverStore.loadServers()
  serverStore.startListening()

  syncServerSelectionFromRoute()
})

onUnmounted(() => {
  serverStore.stopListening()
})
</script>

<template>
  <WorkspaceLayout :message-unread-count="totalUnreadCount">
    <template #message-sidebar>
      <ChannelSidebar
        v-if="showChannelSidebar"
        @server-settings="showServerSettings = true"
        @invite-people="showInviteDialog = true"
        @leave-server="requestLeaveServer"
        @create-category="showCreateCategoryDialog = true"
        @notification-settings="openNotificationSettings"
      />
    </template>

    <NetworkStatusBar />
    <RouterView />
    <WatermarkOverlay :text="watermarkText" />

    <template #overlays>
      <ServerSettings v-model:open="showServerSettings" />
      <InviteDialog
        v-if="serverStore.currentServerId"
        v-model:open="showInviteDialog"
        :space-id="serverStore.currentServerId"
      />

      <CreateCategoryDialog
        v-model:open="showCreateCategoryDialog"
      />

      <Dialog v-model:open="showLeaveConfirm">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{{ t('server.leave_server') }}</DialogTitle>
            <DialogDescription>{{ t('server.leave_server_confirm') }}</DialogDescription>
          </DialogHeader>
          <div class="flex justify-end gap-2">
            <Button variant="ghost" @click="showLeaveConfirm = false">
              {{ t('common.cancel') }}
            </Button>
            <Button
              variant="destructive"
              :disabled="isLeavingServer"
              @click="confirmLeaveServer"
            >
              {{ t('server.leave_server') }}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </template>
  </WorkspaceLayout>
</template>

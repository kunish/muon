<script setup lang="ts">
import { getClient } from '@matrix/client'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import ChannelSidebar from '@/features/server/components/ChannelSidebar.vue'
import CreateCategoryDialog from '@/features/server/components/CreateCategoryDialog.vue'
import InviteDialog from '@/features/server/components/InviteDialog.vue'
import ServerList from '@/features/server/components/ServerList.vue'
import ServerSettings from '@/features/server/components/ServerSettings.vue'
import { useServerStore } from '@/features/server/stores/serverStore'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { useTheme } from '@/shared/composables/useTheme'
import NetworkStatusBar from './NetworkStatusBar.vue'
import WatermarkOverlay from './WatermarkOverlay.vue'

const settingsStore = useSettingsStore()
const serverStore = useServerStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

// Initialize theme (adds .dark class to <html> when dark mode is active)
useTheme()

const showServerSettings = ref(false)
const showInviteDialog = ref(false)
const showCreateCategoryDialog = ref(false)
const showLeaveConfirm = ref(false)
const isLeavingServer = ref(false)

function requestLeaveServer() {
  if (!serverStore.currentServerId)
    return
  showLeaveConfirm.value = true
}

async function confirmLeaveServer() {
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

function openNotificationSettings() {
  router.push({ path: '/settings', query: { tab: 'notifications' } })
}

const watermarkText = computed(() => {
  const date = new Date().toLocaleDateString()
  return `${settingsStore.watermarkEnabled ? 'User' : ''} ${date}`
})

onMounted(() => {
  serverStore.loadServers()
  serverStore.startListening()

  // Initialize from route
  const serverId = route.params.serverId as string
  const channelId = route.params.channelId as string
  if (serverId) {
    serverStore.selectServer(serverId)
    if (channelId) {
      serverStore.selectChannel(channelId)
    }
  }
  else if (route.path.startsWith('/dm')) {
    serverStore.selectServer(null) // DM mode
  }
})

onUnmounted(() => {
  serverStore.stopListening()
})
</script>

<template>
  <div class="flex h-screen bg-background text-foreground overflow-hidden">
    <NetworkStatusBar />

    <!-- Navigation Rail -->
    <ServerList />

    <!-- Sidebar -->
    <ChannelSidebar
      @server-settings="showServerSettings = true"
      @invite-people="showInviteDialog = true"
      @leave-server="requestLeaveServer"
      @create-category="showCreateCategoryDialog = true"
      @notification-settings="openNotificationSettings"
    />

    <!-- Content -->
    <main class="flex-1 flex min-w-0 bg-background">
      <RouterView />
    </main>

    <WatermarkOverlay :text="watermarkText" />

    <!-- Overlays -->
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
  </div>
</template>

<script setup lang="ts">
import CallOverlay from '@features/calls/components/CallOverlay.vue';
import CallWindow from '@features/calls/components/CallWindow.vue';
import { useConversations } from '@features/chat/composables/useConversations';
import ChannelSidebar from '@features/server/components/ChannelSidebar.vue';
import CreateCategoryDialog from '@features/server/components/CreateCategoryDialog.vue';
import InviteDialog from '@features/server/components/InviteDialog.vue';
import ServerSettings from '@features/server/components/ServerSettings.vue';
import { selectChannel, selectServer, serverStore } from '@features/server/stores/serverStore';
import { getClient } from '@matrix/client';
import { getMyDisplayName } from '@matrix/index';
import { settingsStore } from '@shared/stores/settingsStore';
import { useSelector } from '@tanstack/vue-store';
import { toast } from 'vue-sonner';
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue';
import { routeParam } from '@/shared/lib/routeParams';
import { useGlobalShortcuts } from '../composables/useGlobalShortcuts';
import GlobalOverlayHost from './GlobalOverlayHost.vue';
import NetworkStatusBar from './NetworkStatusBar.vue';
import WatermarkOverlay from './WatermarkOverlay.vue';
import { getWorkspaceAppForPath } from './workspace/navigation';
import WorkspaceLayout from './workspace/WorkspaceLayout.vue';

const currentServerId = useSelector(serverStore, (s) => s.currentServerId);
const badgeCount = useSelector(settingsStore, (s) => s.badgeCount);
const watermarkEnabled = useSelector(settingsStore, (s) => s.watermarkEnabled);
const { totalUnreadCount } = useConversations();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useGlobalShortcuts();

const showChannelSidebar = computed(() => {
  return getWorkspaceAppForPath(route.path).id === 'messages';
});

const visibleMessageUnreadCount = computed(() => {
  return badgeCount.value ? totalUnreadCount.value : 0;
});

const showServerSettings = ref(false);
const showInviteDialog = ref(false);
const showCreateCategoryDialog = ref(false);
const showLeaveConfirm = ref(false);
const isLeavingServer = ref(false);

function requestLeaveServer(): void {
  if (!currentServerId.value) return;
  showLeaveConfirm.value = true;
}

async function confirmLeaveServer(): Promise<void> {
  const spaceId = currentServerId.value;
  if (!spaceId || isLeavingServer.value) return;

  isLeavingServer.value = true;
  try {
    await getClient().leave(spaceId);
    selectServer(null);
    showLeaveConfirm.value = false;
    router.push('/dm');
  } catch (err: unknown) {
    console.error('Failed to leave server:', err);
    toast.error(t('auth.error'));
  } finally {
    isLeavingServer.value = false;
  }
}

function openNotificationSettings(): void {
  router.push({ path: '/settings', query: { tab: 'notifications' } });
}

function syncServerSelectionFromRoute(): void {
  const serverId = routeParam(route, 'serverId');
  const channelId = routeParam(route, 'channelId');

  if (route.path.startsWith('/server') && serverId) {
    selectServer(serverId);
    if (channelId) {
      selectChannel(channelId);
    }
    return;
  }

  if (route.path.startsWith('/dm')) {
    selectServer(null);
  }
}

watch(() => route.fullPath, syncServerSelectionFromRoute);

const watermarkText = computed(() => {
  const date = new Date().toLocaleDateString();
  const displayName = getMyDisplayName() || 'User';
  return `${watermarkEnabled.value ? displayName : ''} ${date}`;
});

onMounted(() => {
  syncServerSelectionFromRoute();
});
</script>

<template>
  <WorkspaceLayout :message-unread-count="visibleMessageUnreadCount">
    <template #message-sidebar>
      <ChannelSidebar
        v-show="showChannelSidebar"
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
      <InviteDialog v-if="currentServerId" v-model:open="showInviteDialog" :space-id="currentServerId" />

      <CreateCategoryDialog v-model:open="showCreateCategoryDialog" />

      <ConfirmDialog
        v-model:open="showLeaveConfirm"
        :title="t('server.leave_server')"
        :description="t('server.leave_server_confirm')"
        :confirm-label="t('server.leave_server')"
        :cancel-label="t('common.cancel')"
        :loading="isLeavingServer"
        variant="destructive"
        @confirm="confirmLeaveServer"
        @cancel="showLeaveConfirm = false"
      />
      <GlobalOverlayHost />
      <CallOverlay />
      <CallWindow />
    </template>
  </WorkspaceLayout>
</template>

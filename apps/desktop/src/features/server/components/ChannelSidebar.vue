<script setup lang="ts">
import type { ChannelInfo } from '@/matrix/spaces';
import { Avatar } from '@muon/ui/avatar';
import { Button } from '@muon/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@muon/ui/dialog';
import { Input } from '@muon/ui/input';
import { Label } from '@muon/ui/label';
import { ScrollArea } from '@muon/ui/scroll-area';
import { Textarea } from '@muon/ui/textarea';
import { useSelector } from '@tanstack/vue-store';
import { ChevronDown, X } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import WorkspaceResizablePane from '@/app/components/workspace/WorkspaceResizablePane.vue';
import ConversationList from '@/features/chat/components/ConversationList.vue';
import { loadChannelTree, serverStore } from '@/features/server/stores/serverStore';
import { markRoomAsRead, setRoomName, setRoomTopic, toggleRoomMute } from '@/matrix/rooms';
import { removeRoomFromSpace } from '@/matrix/spaces';
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue';
import ChannelCategory from './ChannelCategory.vue';
import ChannelContextMenu from './ChannelContextMenu.vue';
import CreateChannelDialog from './CreateChannelDialog.vue';
import ServerDropdown from './ServerDropdown.vue';
import TextChannelItem from './TextChannelItem.vue';
import UserPanel from './UserPanel.vue';
import VoiceChannelItem from './VoiceChannelItem.vue';
import VoiceStatusBar from './VoiceStatusBar.vue';

defineEmits<{
  createCategory: [];
  invitePeople: [];
  serverSettings: [];
  notificationSettings: [];
  leaveServer: [];
}>();

const { t } = useI18n();

const SIDEBAR_WIDTH_STORAGE_KEY = 'muon_message_sidebar_width';
const DEFAULT_SIDEBAR_WIDTH = 260;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 360;

const channelTree = useSelector(serverStore, (s) => s.channelTree);
const isDmMode = useSelector(serverStore, (s) => s.isDmMode);
const currentServerId = useSelector(serverStore, (s) => s.currentServerId);
const servers = useSelector(serverStore, (s) => s.servers);
const currentServer = computed(() => {
  if (!currentServerId.value) return null;
  return servers.value.find((s) => s.spaceId === currentServerId.value) ?? null;
});

const showCreateChannel = ref(false);
const createChannelCategoryId = ref<string | undefined>(undefined);
const editingChannel = ref<ChannelInfo | null>(null);
const editChannelName = ref('');
const editChannelTopic = ref('');
const isSavingChannelEdit = ref(false);
const deleteTarget = ref<ChannelInfo | null>(null);
const isDeletingChannel = ref(false);
const resizeHandleLabel = computed(() => t('sidebar.resize_messages'));

function openCreateChannel(categoryId?: string): void {
  createChannelCategoryId.value = categoryId;
  showCreateChannel.value = true;
}

function findChannel(roomId: string): ChannelInfo | null {
  for (const category of channelTree.value) {
    const channel = category.channels.find((item) => item.roomId === roomId);
    if (channel) return channel;
  }
  return null;
}

function refreshCurrentServerChannels(): void {
  if (currentServerId.value) loadChannelTree(currentServerId.value);
}

async function handleMarkChannelAsRead(roomId: string): Promise<void> {
  await markRoomAsRead(roomId);
  refreshCurrentServerChannels();
}

async function handleMuteChannel(roomId: string): Promise<void> {
  await toggleRoomMute(roomId);
  refreshCurrentServerChannels();
}

function handleEditChannel(roomId: string): void {
  const channel = findChannel(roomId);
  if (!channel) return;

  editingChannel.value = channel;
  editChannelName.value = channel.name;
  editChannelTopic.value = channel.topic ?? '';
}

function closeEditChannelDialog(): void {
  editingChannel.value = null;
  editChannelName.value = '';
  editChannelTopic.value = '';
}

async function saveChannelEdit(): Promise<void> {
  const channel = editingChannel.value;
  const name = editChannelName.value.trim();
  if (!channel || !name || isSavingChannelEdit.value) return;

  isSavingChannelEdit.value = true;
  try {
    const topic = editChannelTopic.value.trim();
    if (name !== channel.name) await setRoomName(channel.roomId, name);
    if (topic !== (channel.topic ?? '')) await setRoomTopic(channel.roomId, topic);

    refreshCurrentServerChannels();
    closeEditChannelDialog();
  } catch (error) {
    console.error('Failed to edit channel:', error);
    toast.error(t('server.channel_failed'));
  } finally {
    isSavingChannelEdit.value = false;
  }
}

function handleDeleteChannel(roomId: string): void {
  deleteTarget.value = findChannel(roomId);
}

function closeDeleteChannelDialog(): void {
  deleteTarget.value = null;
}

async function confirmDeleteChannel(): Promise<void> {
  const channel = deleteTarget.value;
  const serverId = currentServerId.value;
  if (!channel || !serverId || isDeletingChannel.value) return;

  isDeletingChannel.value = true;
  try {
    const parentId = channel.categoryId ?? serverId;
    await removeRoomFromSpace(parentId, channel.roomId);

    if (channel.categoryId) {
      try {
        await removeRoomFromSpace(serverId, channel.roomId);
      } catch {
        // Category channels are not always direct children of the top-level server.
      }
    }

    refreshCurrentServerChannels();
    closeDeleteChannelDialog();
  } catch (error) {
    console.error('Failed to delete channel:', error);
    toast.error(t('server.channel_failed'));
  } finally {
    isDeletingChannel.value = false;
  }
}
</script>

<template>
  <WorkspaceResizablePane
    as="aside"
    pane-test-id="channel-sidebar-surface"
    content-test-id="channel-sidebar-content"
    handle-test-id="channel-sidebar-resize-handle"
    :width-storage-key="SIDEBAR_WIDTH_STORAGE_KEY"
    :default-width="DEFAULT_SIDEBAR_WIDTH"
    :min-width="MIN_SIDEBAR_WIDTH"
    :max-width="MAX_SIDEBAR_WIDTH"
    :resize-label="resizeHandleLabel"
    :style="{ background: 'var(--material-sidebar-bg)', backdropFilter: 'blur(24px) saturate(180%)' }"
  >
    <div v-show="isDmMode" data-testid="dm-conversation-sidebar" class="contents">
      <ConversationList />
    </div>

    <div v-if="currentServer" v-show="!isDmMode" class="contents">
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

      <div v-if="channelTree.length <= 2" class="border-b border-sidebar-border px-3 py-3">
        <div class="rounded-lg border border-sidebar-border bg-sidebar-accent p-3">
          <div class="mb-2 flex items-center justify-center">
            <Avatar :src="currentServer.avatar" :alt="currentServer.name" :color-id="currentServer.spaceId" size="xl" />
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
              <ChannelContextMenu
                :channel="channel"
                @mark-as-read="handleMarkChannelAsRead"
                @mute-channel="handleMuteChannel"
                @edit-channel="handleEditChannel"
                @delete-channel="handleDeleteChannel"
              >
                <template #default="{ open }">
                  <TextChannelItem v-if="!channel.isVoice" :channel="channel" :context-menu-open="open" />
                  <VoiceChannelItem v-else :channel="channel" :context-menu-open="open" />
                </template>
              </ChannelContextMenu>
            </template>
          </ChannelCategory>
        </div>
      </ScrollArea>
    </div>

    <VoiceStatusBar />

    <UserPanel />

    <CreateChannelDialog v-model:open="showCreateChannel" :category-id="createChannelCategoryId" />

    <Dialog
      :open="Boolean(editingChannel)"
      @update:open="
        (value) => {
          if (!value) closeEditChannelDialog();
        }
      "
    >
      <DialogContent v-if="editingChannel">
        <DialogHeader>
          <DialogTitle>{{ t('channel.edit_channel') }}</DialogTitle>
          <DialogDescription>
            {{ editingChannel.name }}
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-2">
          <Label for="channel-edit-name" class="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {{ t('channel.channel_name') }}
          </Label>
          <Input
            id="channel-edit-name"
            v-model="editChannelName"
            data-testid="channel-edit-name"
            :placeholder="t('channel.channel_name_placeholder')"
            @keydown.enter="saveChannelEdit"
          />
        </div>

        <div class="space-y-2">
          <Label for="channel-edit-topic" class="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {{ t('channel.channel_topic') }}
          </Label>
          <Textarea
            id="channel-edit-topic"
            v-model="editChannelTopic"
            data-testid="channel-edit-topic"
            class="min-h-20"
            :placeholder="t('channel.channel_topic_placeholder')"
          />
        </div>

        <div class="flex justify-end gap-2">
          <Button variant="ghost" @click="closeEditChannelDialog">
            {{ t('common.cancel') }}
          </Button>
          <Button
            data-testid="channel-edit-save"
            :disabled="!editChannelName.trim() || isSavingChannelEdit"
            @click="saveChannelEdit"
          >
            {{ isSavingChannelEdit ? t('server.saving') : t('common.save') }}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      :open="Boolean(deleteTarget)"
      :title="t('channel.delete_channel')"
      :description="deleteTarget ? t('channel.delete_channel_confirm', { name: deleteTarget.name }) : ''"
      :confirm-label="t('channel.delete_channel')"
      :cancel-label="t('common.cancel')"
      :loading="isDeletingChannel"
      :loading-label="t('server.deleting')"
      confirm-test-id="channel-delete-confirm"
      variant="destructive"
      @update:open="
        (value) => {
          if (!value) closeDeleteChannelDialog();
        }
      "
      @confirm="confirmDeleteChannel"
      @cancel="closeDeleteChannelDialog"
    />
  </WorkspaceResizablePane>
</template>

<script setup lang="ts">
import type { CallMode } from '@matrix/index';
import { findOrCreateDm } from '@matrix/index';
import { useRoomNavigation } from '@shared/composables/useRoomNavigation';
import { Plus, UserPlus } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import WorkspaceResizablePane from '@/app/components/workspace/WorkspaceResizablePane.vue';
import { useCallStore } from '@/features/calls/stores/callStore';
import { useConversations } from '../../chat/composables/useConversations';
import { useContactStore } from '../stores/contactStore';
import AddContactDialog from './AddContactDialog.vue';
import ContactList from './ContactList.vue';
import CreateGroupDialog from './CreateGroupDialog.vue';
import GroupSettings from './GroupSettings.vue';
import UserProfile from './UserProfile.vue';

const { t } = useI18n();
const router = useRouter();
const store = useContactStore();
const chatStore = useRoomNavigation();
const callStore = useCallStore();
const { restoreRoom } = useConversations();

const showCreateGroup = ref(false);
const showAddContact = ref(false);
const selectedGroupId = ref<string | null>(null);

const CONTACTS_WIDTH_STORAGE_KEY = 'muon_contacts_sidebar_width';
const DEFAULT_CONTACTS_WIDTH = 240;
const MIN_CONTACTS_WIDTH = 220;
const MAX_CONTACTS_WIDTH = 360;
const contactsResizeLabel = computed(() => t('sidebar.resize_contacts'));

onMounted(() => {
  void store.loadContacts();
  void store.loadGroups();
});

function handleSelectContact(userId: string): void {
  selectedGroupId.value = null;
  store.selectedContactId = userId;
}

function handleGroupCreated(roomId: string): void {
  showCreateGroup.value = false;
  selectedGroupId.value = roomId;
}

async function handleContactAdded(userId: string): Promise<void> {
  showAddContact.value = false;
  await store.loadContacts();
  handleSelectContact(userId);
}

function handleSelectGroup(roomId: string): void {
  store.selectedContactId = null;
  selectedGroupId.value = roomId;
}

async function handleOpenMessage(userId: string): Promise<void> {
  try {
    const contact = store.contacts.find((item) => item.userId === userId);
    const roomId = await findOrCreateDm(userId);
    restoreRoom(roomId);
    chatStore.navigateToRoom(roomId, {
      sidebarPlacement: 'promote',
      sidebarPreview: {
        name: contact?.displayName,
        avatar: contact?.avatarUrl,
        dmUserId: userId,
        dmUserAvatar: contact?.avatarUrl,
        isDirect: true,
      },
    });
    router.push(`/dm/${encodeURIComponent(roomId)}`);
  } catch {
    toast.error(t('auth.error'));
  }
}

async function handleStartContactCall(userId: string, mode: CallMode): Promise<void> {
  const contact = store.contacts.find((item) => item.userId === userId);
  try {
    const roomId = await findOrCreateDm(userId);
    restoreRoom(roomId);
    await callStore.startCall(roomId, userId, contact?.displayName || userId, mode);
  } catch {
    toast.error(t('auth.error'));
  }
}
</script>

<template>
  <div class="flex h-full min-w-0 flex-1 bg-background">
    <WorkspaceResizablePane
      as="aside"
      pane-test-id="contacts-sidebar"
      content-test-id="contacts-sidebar-content"
      handle-test-id="contacts-sidebar-resize-handle"
      :width-storage-key="CONTACTS_WIDTH_STORAGE_KEY"
      :default-width="DEFAULT_CONTACTS_WIDTH"
      :min-width="MIN_CONTACTS_WIDTH"
      :max-width="MAX_CONTACTS_WIDTH"
      :resize-label="contactsResizeLabel"
    >
      <div class="border-b border-sidebar-border px-4 pb-4 pt-6">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h1 class="text-[18px] font-semibold leading-6">
              {{ t('contacts.title') }}
            </h1>
            <p class="mt-1 text-[13px] text-muted-foreground">Directory &amp; Organization</p>
          </div>
          <div class="flex items-center gap-1">
            <button
              class="rounded-md p-1.5 text-primary transition-colors hover:bg-sidebar-accent"
              :title="t('contacts.add_contact')"
              data-testid="contacts-add-contact"
              @click="showAddContact = true"
            >
              <UserPlus :size="16" />
            </button>
            <button
              class="rounded-md p-1.5 text-primary transition-colors hover:bg-sidebar-accent"
              :title="t('contacts.create_group')"
              @click="showCreateGroup = true"
            >
              <Plus :size="16" />
            </button>
          </div>
        </div>
      </div>

      <ContactList
        class="min-h-0 flex-1"
        :selected-group-id="selectedGroupId"
        @select="handleSelectContact"
        @open="handleSelectContact"
        @select-group="handleSelectGroup"
      />
    </WorkspaceResizablePane>

    <section class="flex min-w-0 flex-1 flex-col bg-background">
      <header class="flex h-14 shrink-0 items-center justify-between border-b border-border bg-sidebar px-4">
        <div class="flex min-w-0 items-center gap-3">
          <span class="text-[13px] font-semibold text-foreground">Muon Workspace</span>
          <span class="text-muted-foreground">/</span>
          <span class="truncate text-[13px] text-muted-foreground">
            {{ selectedGroupId ? t('contacts.groups') : t('contacts.contacts') }}
          </span>
        </div>
      </header>

      <div class="flex min-h-0 min-w-0 flex-1">
        <GroupSettings v-if="selectedGroupId" :room-id="selectedGroupId" @leave="selectedGroupId = null" />
        <UserProfile
          v-else
          @message="handleOpenMessage"
          @audio-call="(userId) => handleStartContactCall(userId, 'audio')"
          @video-call="(userId) => handleStartContactCall(userId, 'video')"
        />
      </div>
    </section>

    <CreateGroupDialog v-if="showCreateGroup" @close="showCreateGroup = false" @created="handleGroupCreated" />
    <AddContactDialog v-if="showAddContact" @close="showAddContact = false" @added="handleContactAdded" />
  </div>
</template>

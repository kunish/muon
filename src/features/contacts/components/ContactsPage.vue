<script setup lang="ts">
import { findOrCreateDm } from '@matrix/index'
import { Plus } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import WorkspaceResizablePane from '@/app/components/workspace/WorkspaceResizablePane.vue'
import { useConversations } from '../../chat/composables/useConversations'
import { useChatStore } from '../../chat/stores/chatStore'
import { useContactStore } from '../stores/contactStore'
import ContactList from './ContactList.vue'
import CreateGroupDialog from './CreateGroupDialog.vue'
import GroupSettings from './GroupSettings.vue'
import UserProfile from './UserProfile.vue'

const { t } = useI18n()
const router = useRouter()
const store = useContactStore()
const chatStore = useChatStore()
const { restoreRoom } = useConversations()

const showCreateGroup = ref(false)
const selectedGroupId = ref<string | null>(null)

const CONTACTS_WIDTH_STORAGE_KEY = 'muon_contacts_sidebar_width'
const DEFAULT_CONTACTS_WIDTH = 308
const MIN_CONTACTS_WIDTH = 260
const MAX_CONTACTS_WIDTH = 430
const contactsResizeLabel = computed(() => t('sidebar.resize_contacts'))

onMounted(() => {
  void store.loadContacts()
  void store.loadGroups()
})

function handleSelectContact(userId: string): void {
  selectedGroupId.value = null
  store.selectedContactId = userId
}

function handleGroupCreated(roomId: string): void {
  showCreateGroup.value = false
  selectedGroupId.value = roomId
}

function handleSelectGroup(roomId: string): void {
  store.selectedContactId = null
  selectedGroupId.value = roomId
}

async function handleOpenMessage(userId: string): Promise<void> {
  try {
    const contact = store.contacts.find(item => item.userId === userId)
    const roomId = await findOrCreateDm(userId)
    restoreRoom(roomId)
    chatStore.setCurrentRoom(roomId, {
      sidebarPlacement: 'promote',
      sidebarPreview: {
        name: contact?.displayName,
        avatar: contact?.avatarUrl,
        dmUserId: userId,
        dmUserAvatar: contact?.avatarUrl,
        isDirect: true,
      },
    })
    router.push(`/dm/${encodeURIComponent(roomId)}`)
  }
  catch {
    toast.error(t('auth.error'))
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
      <div class="flex items-center justify-between border-b border-sidebar-border/80 p-3.5">
        <span class="text-sm font-medium">{{ t('contacts.title') }}</span>
        <button
          class="rounded-xl p-1.5 text-primary transition-all hover:bg-sidebar-accent"
          :title="t('contacts.create_group')"
          @click="showCreateGroup = true"
        >
          <Plus :size="14" />
        </button>
      </div>

      <ContactList
        class="min-h-0 flex-1"
        :selected-group-id="selectedGroupId"
        @select="handleSelectContact"
        @open="handleSelectContact"
        @select-group="handleSelectGroup"
      />
    </WorkspaceResizablePane>

    <div class="flex min-w-0 flex-1 bg-background">
      <GroupSettings
        v-if="selectedGroupId"
        :room-id="selectedGroupId"
        @leave="selectedGroupId = null"
      />
      <UserProfile
        v-else
        @message="handleOpenMessage"
      />
    </div>

    <CreateGroupDialog
      v-if="showCreateGroup"
      @close="showCreateGroup = false"
      @created="handleGroupCreated"
    />
  </div>
</template>

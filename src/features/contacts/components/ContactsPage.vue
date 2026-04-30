<script setup lang="ts">
import { findOrCreateDm } from '@matrix/index'
import { Plus } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useConversations } from '../../chat/composables/useConversations'
import { useContactStore } from '../stores/contactStore'
import ContactList from './ContactList.vue'
import CreateGroupDialog from './CreateGroupDialog.vue'
import GroupSettings from './GroupSettings.vue'
import UserProfile from './UserProfile.vue'

const { t } = useI18n()
const router = useRouter()
const store = useContactStore()
const { restoreRoom } = useConversations()

const showCreateGroup = ref(false)
const selectedGroupId = ref<string | null>(null)

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
    const roomId = await findOrCreateDm(userId)
    restoreRoom(roomId)
    router.push(`/dm/${encodeURIComponent(roomId)}`)
  }
  catch {
    toast.error(t('auth.error'))
  }
}
</script>

<template>
  <div class="flex h-full min-w-0 flex-1 bg-background">
    <div class="workspace-panel flex w-[308px] shrink-0 flex-col rounded-none border-y-0 border-l-0 bg-sidebar/95 backdrop-blur-xl">
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
    </div>

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

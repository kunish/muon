<script setup lang="ts">
import { findOrCreateDm } from '@matrix/index'
import Avatar from '@/shared/components/ui/avatar/Avatar.vue'
import { Plus } from 'lucide-vue-next'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
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

function handleSelectContact(userId: string) {
  selectedGroupId.value = null
  store.selectedContactId = userId
}

function handleGroupCreated(roomId: string) {
  showCreateGroup.value = false
  selectedGroupId.value = roomId
}

function handleSelectGroup(roomId: string) {
  store.selectedContactId = null
  selectedGroupId.value = roomId
}

/** 从联系人资料卡点击"消息"：找到或创建 DM 房间后跳转 */
async function handleOpenMessage(userId: string) {
  try {
    const roomId = await findOrCreateDm(userId)
    restoreRoom(roomId)
    router.push(`/chat/${roomId}`)
  }
  catch (err) {
    console.error('打开私聊失败:', err)
  }
}
</script>

<template>
  <div class="flex h-full">
    <div class="w-64 border-r border-border flex flex-col">
      <div class="p-3 border-b border-border flex items-center justify-between">
        <span class="text-sm font-medium">{{ t('contacts.title') }}</span>
        <button
          class="p-1 rounded hover:bg-accent text-primary"
          :title="t('contacts.create_group')"
          @click="showCreateGroup = true"
        >
          <Plus :size="14" />
        </button>
      </div>

      <ContactList
        @select="handleSelectContact"
        @open="handleSelectContact"
      />

      <div
        v-if="store.groups.length > 0"
        class="border-t border-border"
      >
        <div class="p-3 text-xs text-muted-foreground font-medium">
          {{ t('contacts.groups') }}
        </div>
        <div
          v-for="group in store.groups"
          :key="group.roomId"
          class="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors"
          :class="selectedGroupId === group.roomId ? 'bg-accent' : 'hover:bg-accent/50'"
          @click="handleSelectGroup(group.roomId)"
        >
          <Avatar :alt="group.name" :color-id="group.roomId || group.name" size="sm" />
          <div class="flex-1 min-w-0">
            <div class="text-sm truncate">
              {{ group.name }}
            </div>
            <div class="text-xs text-muted-foreground">
              {{ t('contacts.member_count', { count: group.memberCount }) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1">
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

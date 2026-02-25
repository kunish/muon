<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import { ref } from 'vue'
import { useContactStore } from '../stores/contactStore'
import ContactList from './ContactList.vue'
import CreateGroupDialog from './CreateGroupDialog.vue'
import GroupSettings from './GroupSettings.vue'
import UserProfile from './UserProfile.vue'

const store = useContactStore()

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
</script>

<template>
  <div class="flex h-full">
    <div class="w-64 border-r border-border flex flex-col">
      <div class="p-3 border-b border-border flex items-center justify-between">
        <span class="text-sm font-medium">联系人</span>
        <button
          class="p-1 rounded hover:bg-accent text-primary"
          title="创建群组"
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
          群组
        </div>
        <div
          v-for="group in store.groups"
          :key="group.roomId"
          class="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors"
          :class="selectedGroupId === group.roomId ? 'bg-accent' : 'hover:bg-accent/50'"
          @click="handleSelectGroup(group.roomId)"
        >
          <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
            {{ group.name.slice(0, 1) }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm truncate">
              {{ group.name }}
            </div>
            <div class="text-xs text-muted-foreground">
              {{ group.memberCount }} 人
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1">
      <GroupSettings
        v-if="selectedGroupId"
        :room-id="selectedGroupId"
      />
      <UserProfile
        v-else
        @message="$router.push(`/chat/${$event}`)"
      />
    </div>

    <CreateGroupDialog
      v-if="showCreateGroup"
      @close="showCreateGroup = false"
      @created="handleGroupCreated"
    />
  </div>
</template>

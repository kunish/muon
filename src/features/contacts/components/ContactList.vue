<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import Avatar from '@/shared/components/ui/avatar/Avatar.vue'
import { useContactStore } from '../stores/contactStore'
import ContactItem from './ContactItem.vue'

const props = defineProps<{
  selectedGroupId?: string | null
}>()

const emit = defineEmits<{
  select: [userId: string]
  open: [userId: string]
  selectGroup: [roomId: string]
}>()

const { t } = useI18n()
const store = useContactStore()

function handleSelectContact(userId: string): void {
  store.selectedContactId = userId
  emit('select', userId)
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="shrink-0 p-3">
      <label
        data-testid="contacts-search-control"
        class="flex h-8 items-center gap-2 rounded-md border border-transparent bg-input px-3 text-muted-foreground focus-within:border-primary"
      >
        <Search
          :size="16"
          data-testid="contacts-search-icon"
          class="size-4 shrink-0 text-muted-foreground"
        />
        <input
          v-model="store.searchQuery"
          data-testid="contacts-search-input"
          type="text"
          :placeholder="t('contacts.search')"
          class="h-full min-w-0 flex-1 bg-transparent text-[13px] leading-5 text-foreground outline-none placeholder:text-muted-foreground"
        >
      </label>
    </div>
    <div
      data-testid="contacts-list-scroll-container"
      class="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
    >
      <section v-if="store.filteredContacts.length > 0" class="space-y-0.5">
        <div class="px-2 pb-1 pt-1 text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
          {{ t('contacts.contacts') }}
        </div>
        <ContactItem
          v-for="contact in store.filteredContacts"
          :key="contact.userId"
          :contact="contact"
          :selected="store.selectedContactId === contact.userId"
          @click="handleSelectContact(contact.userId)"
          @dblclick="emit('open', contact.userId)"
        />
      </section>
      <section
        v-if="store.filteredGroups.length > 0"
        class="space-y-0.5"
        :class="store.filteredContacts.length > 0 ? 'pt-3' : 'pt-1'"
      >
        <div class="px-2 pb-1 text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
          {{ t('contacts.groups') }}
        </div>
        <button
          v-for="group in store.filteredGroups"
          :key="group.roomId"
          type="button"
          class="workspace-row gap-2 px-3 py-2 text-left text-muted-foreground"
          :class="props.selectedGroupId === group.roomId ? 'workspace-row-active' : ''"
          :data-testid="`contacts-group-row-${group.roomId}`"
          @click="emit('selectGroup', group.roomId)"
        >
          <Avatar :alt="group.name" :color-id="group.roomId || group.name" size="sm" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-[13px] font-semibold">
              {{ group.name }}
            </div>
            <div class="truncate text-[12px] text-muted-foreground">
              {{ t('contacts.member_count', { count: group.memberCount }) }}
            </div>
          </div>
        </button>
      </section>
      <div
        v-if="store.filteredContacts.length === 0 && store.filteredGroups.length === 0"
        class="px-4 py-8 text-center text-sm text-muted-foreground"
      >
        {{ t('contacts.empty') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useContactStore } from '../stores/contactStore'
import ContactItem from './ContactItem.vue'

const emit = defineEmits<{
  select: [userId: string]
  open: [userId: string]
}>()

const { t } = useI18n()
const store = useContactStore()
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="p-3">
      <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
        <Search :size="14" class="text-muted-foreground" />
        <input
          v-model="store.searchQuery"
          type="text"
          :placeholder="t('contacts.search')"
          class="flex-1 bg-transparent text-sm outline-none"
        >
      </div>
    </div>
    <div class="flex-1 overflow-y-auto">
      <ContactItem
        v-for="contact in store.filteredContacts"
        :key="contact.userId"
        :contact="contact"
        :selected="store.selectedContactId === contact.userId"
        @click="store.selectedContactId = contact.userId; emit('select', contact.userId)"
        @dblclick="emit('open', contact.userId)"
      />
      <div
        v-if="store.filteredContacts.length === 0"
        class="px-4 py-8 text-center text-sm text-muted-foreground"
      >
        {{ t('contacts.empty') }}
      </div>
    </div>
  </div>
</template>

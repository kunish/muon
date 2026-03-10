<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContactStore } from '@/features/contacts/stores/contactStore'
import { Avatar } from '@/shared/components/ui/avatar'

const emit = defineEmits<{
  select: [contact: { userId: string, displayName: string, avatarUrl?: string }]
  close: []
}>()

const { t } = useI18n()
const contactStore = useContactStore()
const query = ref('')

onMounted(() => {
  contactStore.loadContacts()
})

const filtered = computed(() => {
  if (!query.value)
    return contactStore.contacts
  const q = query.value.toLowerCase()
  return contactStore.contacts.filter(c =>
    c.displayName.toLowerCase().includes(q) || c.userId.toLowerCase().includes(q),
  )
})

function onSelect(c: { userId: string, displayName: string, avatarUrl?: string }) {
  emit('select', c)
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="emit('close')">
    <div class="bg-background border border-border rounded-xl shadow-xl w-[360px] max-h-[480px] flex flex-col overflow-hidden">
      <div class="px-4 pt-4 pb-2">
        <h3 class="text-sm font-medium mb-2">
          {{ t('chat.contact_card_pick') }}
        </h3>
        <div class="relative">
          <Search :size="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            v-model="query"
            :placeholder="t('contacts.search_contacts')"
            class="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-muted/30 outline-none focus:ring-1 focus:ring-primary/40"
          >
        </div>
      </div>
      <div class="flex-1 overflow-y-auto px-2 pb-2">
        <div
          v-if="filtered.length === 0"
          class="text-center text-sm text-muted-foreground py-8"
        >
          {{ t('contacts.no_contacts') }}
        </div>
        <button
          v-for="c in filtered"
          :key="c.userId"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left"
          @click="onSelect(c)"
        >
          <Avatar
            :src="c.avatarUrl"
            :alt="c.displayName"
            :color-id="c.userId"
            size="sm"
            shape="circle"
          />
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">
              {{ c.displayName }}
            </div>
            <div class="text-[11px] text-muted-foreground truncate">
              {{ c.userId }}
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

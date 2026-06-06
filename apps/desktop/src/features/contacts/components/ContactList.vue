<script setup lang="ts">
import type { Contact } from '../types';
import { Avatar } from '@muon/ui/avatar';
import { SearchBox } from '@muon/ui/search-box';
import { useSelector } from '@tanstack/vue-store';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { filterContacts, filterGroups } from '../queries/contactsApi';
import { useContactsQuery, useGroupsQuery } from '../queries/useContacts';
import { contactStore, getContactProfile, selectContact, setSearchQuery } from '../stores/contactStore';
import ContactItem from './ContactItem.vue';

const props = defineProps<{
  selectedGroupId?: string | null;
}>();

const emit = defineEmits<{
  select: [userId: string];
  open: [userId: string];
  selectGroup: [roomId: string];
}>();

const { t } = useI18n();
const contactsQuery = useContactsQuery();
const groupsQuery = useGroupsQuery();
const searchQueryState = useSelector(contactStore, (s) => s.searchQuery);
const selectedContactId = useSelector(contactStore, (s) => s.selectedContactId);
const profiles = useSelector(contactStore, (s) => s.contactProfiles);

const searchQuery = computed({
  get: () => searchQueryState.value,
  set: (value: string) => setSearchQuery(value),
});

const filteredContacts = computed(() => filterContacts(contactsQuery.contacts.value, searchQueryState.value));
const filteredGroups = computed(() => filterGroups(groupsQuery.groups.value, searchQueryState.value));

const UNTAGGED = '__untagged__';

// 按标签分组联系人；无标签的归在默认「联系人」分组下，标签组按名称排序、默认组置底
const contactGroups = computed<{ tag: string; label: string; contacts: Contact[] }[]>(() => {
  const buckets = new Map<string, Contact[]>();
  for (const contact of filteredContacts.value) {
    const tag = getContactProfile(profiles.value, contact.userId).tag.trim() || UNTAGGED;
    const list = buckets.get(tag) ?? [];
    list.push(contact);
    buckets.set(tag, list);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a === UNTAGGED ? 1 : b === UNTAGGED ? -1 : a.localeCompare(b)))
    .map(([tag, contacts]) => ({ tag, label: tag === UNTAGGED ? t('contacts.contacts') : tag, contacts }));
});

function handleSelectContact(userId: string): void {
  selectContact(userId);
  emit('select', userId);
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="shrink-0 p-3">
      <SearchBox v-model="searchQuery" data-testid="contacts-search-control" :placeholder="t('contacts.search')" />
    </div>
    <div data-testid="contacts-list-scroll-container" class="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
      <section
        v-for="group in contactGroups"
        :key="group.tag"
        class="space-y-0.5"
        :data-testid="`contacts-tag-group-${group.tag}`"
      >
        <div class="px-2 pb-1 pt-1 text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
          {{ group.label }}
        </div>
        <ContactItem
          v-for="contact in group.contacts"
          :key="contact.userId"
          :contact="contact"
          :selected="selectedContactId === contact.userId"
          @click="handleSelectContact(contact.userId)"
          @dblclick="emit('open', contact.userId)"
        />
      </section>
      <section
        v-if="filteredGroups.length > 0"
        class="space-y-0.5"
        :class="filteredContacts.length > 0 ? 'pt-3' : 'pt-1'"
      >
        <div class="px-2 pb-1 text-[11px] font-bold uppercase leading-4 tracking-[0.05em] text-muted-foreground">
          {{ t('contacts.groups') }}
        </div>
        <button
          v-for="group in filteredGroups"
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
        v-if="filteredContacts.length === 0 && filteredGroups.length === 0"
        class="px-4 py-8 text-center text-sm text-muted-foreground"
      >
        {{ t('contacts.empty') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { findOrCreateDm } from '@matrix/index';
import { Avatar } from '@muon/ui/avatar';
import { Search, UserPlus, X } from 'lucide-vue-next';
import { onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { useContacts } from '../composables/useContacts';

const emit = defineEmits<{
  close: [];
  added: [userId: string];
}>();

const { t } = useI18n();
const { searchUsers } = useContacts();

interface DirectoryResult {
  user_id: string;
  display_name?: string;
  avatar_url?: string;
}

const term = ref('');
const results = ref<DirectoryResult[]>([]);
const searching = ref(false);
const adding = ref<string | null>(null);

let searchSeq = 0;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

async function runSearch(): Promise<void> {
  const query = term.value.trim();
  if (!query) {
    results.value = [];
    return;
  }
  const mine = ++searchSeq;
  searching.value = true;
  try {
    const found = (await searchUsers(query)) as DirectoryResult[];
    if (mine !== searchSeq) return;
    results.value = found;
  } catch {
    if (mine === searchSeq) results.value = [];
  } finally {
    if (mine === searchSeq) searching.value = false;
  }
}

function onInput(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void runSearch(), 250);
}

async function addContact(userId: string): Promise<void> {
  if (adding.value) return;
  adding.value = userId;
  try {
    // 与陌生人建立 DM 即让其成为联系人（contactStore.loadContacts 以 DM 派生联系人）
    await findOrCreateDm(userId);
    emit('added', userId);
  } catch {
    toast.error(t('auth.error'));
  } finally {
    adding.value = null;
  }
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<template>
  <div
    class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
    data-testid="add-contact-dialog"
    @click.self="emit('close')"
  >
    <div class="w-[400px] rounded-lg border border-border bg-popover p-4 shadow-2xl">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-[15px] font-semibold text-foreground">{{ t('contacts.add_contact') }}</h2>
        <button class="rounded p-1 text-muted-foreground hover:bg-accent" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>

      <label
        class="flex h-9 items-center gap-2 rounded-md border border-border bg-input px-3 text-muted-foreground focus-within:border-primary"
      >
        <Search :size="16" />
        <input
          v-model="term"
          data-testid="add-contact-search"
          type="text"
          :placeholder="t('contacts.search_user_placeholder')"
          class="h-full min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          @input="onInput"
          @keydown.enter="runSearch"
        />
      </label>

      <div class="mt-3 max-h-[320px] min-h-[80px] overflow-y-auto">
        <div v-if="searching" class="py-8 text-center text-[13px] text-muted-foreground">
          {{ t('contacts.searching') }}
        </div>
        <div
          v-else-if="results.length === 0"
          class="py-8 text-center text-[13px] text-muted-foreground"
          data-testid="add-contact-empty"
        >
          {{ term.trim() ? t('contacts.no_results') : t('contacts.search_user_hint') }}
        </div>
        <button
          v-for="user in results"
          v-else
          :key="user.user_id"
          type="button"
          :data-testid="`add-contact-result-${user.user_id}`"
          class="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
          :disabled="adding === user.user_id"
          @click="addContact(user.user_id)"
        >
          <Avatar :src="user.avatar_url" :alt="user.display_name || user.user_id" :color-id="user.user_id" size="sm" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13px] font-semibold">{{ user.display_name || user.user_id }}</span>
            <span class="block truncate text-[12px] text-muted-foreground">{{ user.user_id }}</span>
          </span>
          <UserPlus :size="16" class="shrink-0 text-primary" />
        </button>
      </div>
    </div>
  </div>
</template>

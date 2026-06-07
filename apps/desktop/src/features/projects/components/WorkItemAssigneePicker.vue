<script setup lang="ts">
import { getClient } from '@matrix/client';
import { Avatar } from '@muon/ui/avatar';
import { useContactList } from '@shared/composables/useContactList';
import { Check, Search, X } from 'lucide-vue-next';

interface DirectoryUser {
  user_id: string;
  display_name?: string;
  avatar_url?: string | null;
}

interface AssigneeOption {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  source: 'contact' | 'directory' | 'direct';
}

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    placeholder?: string;
  }>(),
  {
    modelValue: undefined,
    placeholder: undefined,
  },
);

const emit = defineEmits<{ 'update:modelValue': [value: string | undefined] }>();

const { t } = useI18n();
const contactList = useContactList();

const query = ref('');
const pickerOpen = ref(false);
const searching = ref(false);
const directoryResults = ref<AssigneeOption[]>([]);
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let searchSeq = 0;

onMounted(() => {
  contactList.ensureContactsLoaded();
});

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer);
});

watch(query, (value) => {
  if (searchTimer) clearTimeout(searchTimer);

  const seq = ++searchSeq;
  const term = value.trim();
  if (!term) {
    directoryResults.value = [];
    searching.value = false;
    return;
  }

  searching.value = true;
  searchTimer = setTimeout(async () => {
    try {
      const client = getClient();
      const response = (await client.searchUserDirectory({ term, limit: 8 })) as { results?: DirectoryUser[] };
      const results = response.results ?? [];
      if (seq !== searchSeq) return;

      directoryResults.value = results.map((user) => ({
        userId: user.user_id,
        displayName: user.display_name || fallbackName(user.user_id),
        avatarUrl: user.avatar_url || undefined,
        source: 'directory',
      }));
    } catch {
      if (seq === searchSeq) directoryResults.value = [];
    } finally {
      if (seq === searchSeq) searching.value = false;
    }
  }, 200);
});

const contactOptions = computed<AssigneeOption[]>(() =>
  contactList.contacts.map((contact) => ({
    userId: contact.userId,
    displayName: contact.displayName,
    avatarUrl: contact.avatarUrl,
    source: 'contact',
  })),
);

const directOption = computed<AssigneeOption | null>(() => {
  const userId = query.value.trim();
  if (!userId.startsWith('@') || !userId.includes(':')) return null;

  return {
    userId,
    displayName: fallbackName(userId),
    source: 'direct',
  };
});

const optionById = computed(() => {
  const options = new Map<string, AssigneeOption>();
  for (const option of [...contactOptions.value, ...directoryResults.value]) options.set(option.userId, option);
  return options;
});

const selectedAssignee = computed<AssigneeOption | null>(() => {
  if (!props.modelValue) return null;
  return (
    optionById.value.get(props.modelValue) ?? {
      userId: props.modelValue,
      displayName: fallbackName(props.modelValue),
      source: 'direct',
    }
  );
});

const visibleOptions = computed<AssigneeOption[]>(() => {
  const term = query.value.trim().toLowerCase();
  const options = new Map<string, AssigneeOption>();

  for (const option of contactOptions.value) {
    if (!term || matchesOption(option, term)) options.set(option.userId, option);
  }

  if (term) {
    if (directOption.value) options.set(directOption.value.userId, directOption.value);

    for (const option of directoryResults.value) options.set(option.userId, option);
  }

  return [...options.values()];
});

function fallbackName(userId: string): string {
  return userId.split(':')[0]?.replace(/^@/, '') || userId;
}

function matchesOption(option: AssigneeOption, term: string): boolean {
  return option.displayName.toLowerCase().includes(term) || option.userId.toLowerCase().includes(term);
}

function selectAssignee(userId: string): void {
  emit('update:modelValue', userId);
  query.value = '';
  pickerOpen.value = false;
}

function clearAssignee(): void {
  emit('update:modelValue', undefined);
  pickerOpen.value = true;
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-if="selectedAssignee"
      data-testid="project-assignee-selected"
      class="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-muted/25 px-2 py-1.5"
    >
      <Avatar
        :src="selectedAssignee.avatarUrl"
        :alt="selectedAssignee.displayName"
        :color-id="selectedAssignee.userId"
        size="sm"
        shape="circle"
      />
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium">
          {{ selectedAssignee.displayName }}
        </div>
        <div class="truncate text-xs text-muted-foreground">
          {{ selectedAssignee.userId }}
        </div>
      </div>
      <button
        type="button"
        data-testid="project-assignee-clear"
        class="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
        :aria-label="t('common.clear')"
        @click="clearAssignee"
      >
        <X :size="14" />
      </button>
    </div>

    <label
      class="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-muted-foreground focus-within:ring-1 focus-within:ring-primary/50"
      data-testid="project-assignee-search-control"
      :aria-expanded="pickerOpen"
    >
      <Search :size="14" class="shrink-0" />
      <input
        v-model="query"
        data-testid="project-assignee-search"
        type="text"
        :placeholder="placeholder || t('projects.assignee_placeholder')"
        class="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
        @focus="pickerOpen = true"
      />
    </label>

    <div
      v-if="pickerOpen"
      data-testid="project-assignee-options"
      class="max-h-52 overflow-y-auto rounded-lg border border-border bg-background p-1"
    >
      <div v-if="searching && visibleOptions.length === 0" class="px-3 py-6 text-center text-sm text-muted-foreground">
        {{ t('chat.searching') }}
      </div>

      <template v-else-if="visibleOptions.length > 0">
        <button
          v-for="option in visibleOptions"
          :key="option.userId"
          type="button"
          class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
          :class="modelValue === option.userId ? 'bg-primary/10 text-foreground' : 'text-foreground'"
          :data-testid="`project-assignee-option-${option.userId}`"
          :aria-pressed="modelValue === option.userId"
          @click="selectAssignee(option.userId)"
        >
          <Avatar
            :src="option.avatarUrl"
            :alt="option.displayName"
            :color-id="option.userId"
            size="sm"
            shape="circle"
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">{{ option.displayName }}</span>
            <span class="block truncate text-xs text-muted-foreground">{{ option.userId }}</span>
          </span>
          <span
            v-if="option.source === 'direct'"
            class="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            ID
          </span>
          <Check v-if="modelValue === option.userId" :size="15" class="shrink-0 text-primary" />
        </button>
      </template>

      <div v-else class="px-3 py-6 text-center text-sm text-muted-foreground">
        {{ t('contacts.no_matching_members') }}
      </div>
    </div>
  </div>
</template>

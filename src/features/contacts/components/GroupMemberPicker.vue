<script setup lang="ts">
import { Avatar } from '@muon/ui/avatar'
import { Checkbox } from '@muon/ui/checkbox'
import { Label } from '@muon/ui/label'
import { Check, Search, X } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContacts } from '../composables/useContacts'
import { useContactStore } from '../stores/contactStore'

interface MemberOption {
  userId: string
  displayName: string
  avatarUrl?: string
}

const selectedIds = defineModel<string[]>({ default: () => [] })

const { t } = useI18n()
const contactStore = useContactStore()
const { searchUsers } = useContacts()

const query = ref('')
const searching = ref(false)
const directoryResults = ref<MemberOption[]>([])

let searchTimer: ReturnType<typeof setTimeout> | null = null
let searchSeq = 0

onMounted(() => {
  if (contactStore.contacts.length === 0)
    void contactStore.loadContacts().catch(() => {})
})

onUnmounted(() => {
  if (searchTimer)
    clearTimeout(searchTimer)
})

watch(query, (value) => {
  if (searchTimer)
    clearTimeout(searchTimer)

  const seq = ++searchSeq
  const term = value.trim()
  if (!term) {
    directoryResults.value = []
    searching.value = false
    return
  }

  searching.value = true
  searchTimer = setTimeout(async () => {
    try {
      const results = await searchUsers(term)
      if (seq !== searchSeq)
        return
      directoryResults.value = results.map(user => ({
        userId: user.user_id,
        displayName: user.display_name || fallbackName(user.user_id),
        avatarUrl: user.avatar_url || undefined,
      }))
    }
    catch {
      if (seq === searchSeq)
        directoryResults.value = []
    }
    finally {
      if (seq === searchSeq)
        searching.value = false
    }
  }, 250)
})

const contactOptions = computed<MemberOption[]>(() =>
  contactStore.contacts.map(contact => ({
    userId: contact.userId,
    displayName: contact.displayName,
    avatarUrl: contact.avatarUrl,
  })),
)

const optionById = computed(() => {
  const map = new Map<string, MemberOption>()
  for (const option of [...contactOptions.value, ...directoryResults.value])
    map.set(option.userId, option)
  return map
})

const selectedIdSet = computed(() => new Set(selectedIds.value))

const selectedMembers = computed<MemberOption[]>(() =>
  selectedIds.value.map(userId =>
    optionById.value.get(userId) ?? {
      userId,
      displayName: fallbackName(userId),
    },
  ),
)

const visibleMembers = computed<MemberOption[]>(() => {
  const term = query.value.trim().toLowerCase()
  const options = new Map<string, MemberOption>()

  for (const option of contactOptions.value) {
    if (!term || matchesMember(option, term))
      options.set(option.userId, option)
  }

  if (term) {
    for (const option of directoryResults.value) {
      if (!options.has(option.userId))
        options.set(option.userId, option)
    }
  }

  return [...options.values()]
})

function matchesMember(member: MemberOption, term: string): boolean {
  return member.displayName.toLowerCase().includes(term) || member.userId.toLowerCase().includes(term)
}

function fallbackName(userId: string): string {
  return userId.split(':')[0]?.replace(/^@/, '') || userId
}

function toggleMember(userId: string): void {
  if (selectedIdSet.value.has(userId)) {
    selectedIds.value = selectedIds.value.filter(id => id !== userId)
    return
  }

  selectedIds.value = [...selectedIds.value, userId]
}

function removeMember(userId: string): void {
  selectedIds.value = selectedIds.value.filter(id => id !== userId)
}
</script>

<template>
  <div class="space-y-2.5">
    <div class="flex items-center justify-between gap-3">
      <Label class="text-sm text-muted-foreground">
        {{ t('contacts.invite_members') }}
      </Label>
      <span
        data-testid="selected-members-count"
        class="shrink-0 text-xs text-muted-foreground"
      >
        {{ t('contacts.selected_members_count', { count: selectedIds.length }) }}
      </span>
    </div>

    <div
      class="min-h-10 rounded-lg border border-border bg-muted/25 p-2"
      data-testid="selected-members-tray"
    >
      <div v-if="selectedMembers.length > 0" class="flex flex-wrap gap-1.5">
        <button
          v-for="member in selectedMembers"
          :key="member.userId"
          type="button"
          class="inline-flex max-w-full items-center gap-1.5 rounded-full bg-background px-2 py-1 text-xs text-foreground shadow-sm ring-1 ring-border transition-colors hover:bg-accent"
          :data-testid="`selected-member-chip-${member.userId}`"
          @click="removeMember(member.userId)"
        >
          <Avatar
            :src="member.avatarUrl"
            :alt="member.displayName"
            :color-id="member.userId"
            size="xs"
            shape="circle"
          />
          <span class="max-w-28 truncate">{{ member.displayName }}</span>
          <X :size="12" class="shrink-0 text-muted-foreground" />
        </button>
      </div>
      <div v-else class="flex h-6 items-center px-1 text-xs text-muted-foreground/75">
        {{ t('contacts.no_selected_members') }}
      </div>
    </div>

    <label
      class="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-muted-foreground focus-within:ring-1 focus-within:ring-primary/50"
      data-testid="group-member-search-control"
    >
      <Search :size="14" class="shrink-0" />
      <input
        v-model="query"
        data-testid="group-member-search"
        type="text"
        :placeholder="t('contacts.search_members_placeholder')"
        class="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
      >
    </label>

    <div class="max-h-52 overflow-y-auto rounded-lg border border-border bg-background p-1">
      <div
        v-if="searching && visibleMembers.length === 0"
        class="px-3 py-6 text-center text-sm text-muted-foreground"
      >
        {{ t('chat.searching') }}
      </div>

      <template v-else-if="visibleMembers.length > 0">
        <button
          v-for="member in visibleMembers"
          :key="member.userId"
          type="button"
          class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
          :class="selectedIdSet.has(member.userId) ? 'bg-primary/10 text-foreground' : 'text-foreground'"
          :data-testid="`group-member-row-${member.userId}`"
          :aria-pressed="selectedIdSet.has(member.userId)"
          @click="toggleMember(member.userId)"
        >
          <Checkbox
            :model-value="selectedIdSet.has(member.userId)"
            class="pointer-events-none"
            aria-hidden="true"
          />
          <Avatar
            :src="member.avatarUrl"
            :alt="member.displayName"
            :color-id="member.userId"
            size="sm"
            shape="circle"
          />
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium">
              {{ member.displayName }}
            </div>
            <div class="truncate text-xs text-muted-foreground">
              {{ member.userId }}
            </div>
          </div>
          <Check
            v-if="selectedIdSet.has(member.userId)"
            :size="15"
            class="shrink-0 text-primary"
          />
        </button>
      </template>

      <div
        v-else
        class="px-3 py-6 text-center text-sm text-muted-foreground"
      >
        {{ t('contacts.no_matching_members') }}
      </div>
    </div>
  </div>
</template>

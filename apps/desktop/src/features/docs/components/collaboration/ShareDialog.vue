<script setup lang="ts">
import { getClient } from '@matrix/client'
import { useContactList } from '@shared/composables/useContactList'
import { Check, Copy, Link2, Loader2, Send, Users, X } from 'lucide-vue-next'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'

interface UserDirectoryResult {
  user_id: string
  display_name?: string
  avatar_url?: string | null
}

interface DocShareMatrixClient {
  getDomain?: () => string | null
  invite: (roomId: string, userId: string) => Promise<unknown>
  searchUserDirectory?: (query: { term: string, limit: number }) => Promise<{
    results?: UserDirectoryResult[]
  }>
}

interface InviteUserOption {
  userId: string
  displayName: string
  avatarUrl?: string
  source: 'contact' | 'directory' | 'direct'
}

const props = defineProps<{ docId: string, docTitle: string }>()
const emit = defineEmits<{ close: [] }>()

const contactList = useContactList()
const copied = shallowRef(false)
const copyError = shallowRef(false)
const inviteDraft = ref('')
const inviteOptions = ref<InviteUserOption[]>([])
const selectedInviteUsers = ref<InviteUserOption[]>([])
const invitePickerOpen = shallowRef(false)
const searchingInviteUsers = shallowRef(false)
const inviteStatus = shallowRef<'idle' | 'inviting' | 'success' | 'error'>('idle')
const inviteMessage = shallowRef('')
const invitedUsers = ref<string[]>([])
let inviteSearchSeq = 0

onMounted(() => {
  contactList.ensureContactsLoaded()
})

const shareLink = computed(() => `${window.location.origin}/docs/${encodeURIComponent(props.docId)}`)
const directInviteUserId = computed(() => {
  const value = inviteDraft.value.trim()
  return value.startsWith('@') && value.includes(':') ? value : ''
})
const contactInviteOptions = computed<InviteUserOption[]>(() =>
  contactList.contacts.map(contact => ({
    userId: contact.userId,
    displayName: contact.displayName,
    avatarUrl: contact.avatarUrl,
    source: 'contact',
  })),
)
const selectedInviteUserIds = computed(() => new Set(selectedInviteUsers.value.map(user => user.userId)))
const visibleInviteOptions = computed(() => {
  const term = inviteDraft.value.trim().toLowerCase()
  const options = new Map<string, InviteUserOption>()

  const matchedContacts = contactInviteOptions.value.filter(option => !term || matchesInviteOption(option, term))
  for (const option of matchedContacts) {
    if (selectedInviteUserIds.value.has(option.userId))
      continue
    options.set(option.userId, option)
  }

  if (term) {
    const directOption = createDirectInviteOption(inviteDraft.value)
    const shouldShowDirectOption = directOption
      && (inviteDraft.value.trim().startsWith('@') || (matchedContacts.length === 0 && inviteOptions.value.length === 0))

    if (directOption && shouldShowDirectOption && !selectedInviteUserIds.value.has(directOption.userId))
      options.set(directOption.userId, directOption)

    for (const option of inviteOptions.value) {
      if (selectedInviteUserIds.value.has(option.userId))
        continue
      options.set(option.userId, option)
    }
  }

  return [...options.values()]
})
const inviteOptionsEmptyText = computed(() =>
  inviteDraft.value.trim() ? '未找到匹配用户' : '暂无可选协作者',
)
const canInvite = computed(() => {
  return inviteStatus.value !== 'inviting'
    && (selectedInviteUsers.value.length > 0 || !!directInviteUserId.value)
})

watch(inviteDraft, (value) => {
  if (value.trim() && inviteStatus.value !== 'inviting') {
    invitePickerOpen.value = true
    inviteStatus.value = 'idle'
    inviteMessage.value = ''
  }
  void searchInviteOptions(value)
})

function normalizePotentialMatrixId(input: string, client: DocShareMatrixClient): string | null {
  const value = input.trim()
  if (!value)
    return null

  if (value.startsWith('@') && value.includes(':'))
    return value

  const domain = client.getDomain?.()
  if (!domain)
    return null

  if (value.startsWith('@'))
    return `${value}:${domain}`

  if (/^[\w.=/-]+$/.test(value))
    return `@${value}:${domain}`

  return null
}

function fallbackName(userId: string): string {
  return userId.split(':')[0]?.replace(/^@/, '') || userId
}

function matchesInviteOption(option: InviteUserOption, term: string): boolean {
  return option.displayName.toLowerCase().includes(term) || option.userId.toLowerCase().includes(term)
}

function createDirectInviteOption(input: string): InviteUserOption | null {
  try {
    const client = getClient() as DocShareMatrixClient
    const userId = normalizePotentialMatrixId(input, client)
    if (!userId)
      return null
    return {
      userId,
      displayName: fallbackName(userId),
      source: 'direct',
    }
  }
  catch {
    return null
  }
}

function createDirectoryInviteOption(user: UserDirectoryResult): InviteUserOption {
  return {
    userId: user.user_id,
    displayName: user.display_name || fallbackName(user.user_id),
    avatarUrl: user.avatar_url || undefined,
    source: 'directory',
  }
}

async function searchInviteOptions(input: string): Promise<void> {
  const term = input.trim()
  const seq = ++inviteSearchSeq

  if (!term) {
    inviteOptions.value = []
    searchingInviteUsers.value = false
    return
  }

  searchingInviteUsers.value = true
  try {
    const client = getClient() as DocShareMatrixClient
    const results = (await client.searchUserDirectory?.({ term, limit: 8 }))?.results ?? []
    if (seq !== inviteSearchSeq)
      return

    inviteOptions.value = results.map(createDirectoryInviteOption)
  }
  catch {
    if (seq === inviteSearchSeq)
      inviteOptions.value = []
  }
  finally {
    if (seq === inviteSearchSeq)
      searchingInviteUsers.value = false
  }
}

function selectInviteUser(option: InviteUserOption): void {
  if (!selectedInviteUserIds.value.has(option.userId))
    selectedInviteUsers.value = [...selectedInviteUsers.value, option]
  inviteDraft.value = ''
  inviteOptions.value = []
  invitePickerOpen.value = true
  inviteStatus.value = 'idle'
  inviteMessage.value = ''
}

function clearSelectedInviteUser(userId: string): void {
  selectedInviteUsers.value = selectedInviteUsers.value.filter(user => user.userId !== userId)
  invitePickerOpen.value = true
}

async function inviteCollaborator(): Promise<void> {
  const targetUserIds = selectedInviteUsers.value.map(user => user.userId)
  const directUserId = directInviteUserId.value
  if (directUserId && !targetUserIds.includes(directUserId))
    targetUserIds.push(directUserId)

  if (targetUserIds.length === 0) {
    inviteStatus.value = 'error'
    inviteMessage.value = '请选择要邀请的协作者'
    return
  }

  inviteStatus.value = 'inviting'
  inviteMessage.value = ''

  try {
    const client = getClient() as DocShareMatrixClient
    await Promise.all(targetUserIds.map(userId => client.invite(props.docId, userId)))
    invitedUsers.value = [
      ...targetUserIds,
      ...invitedUsers.value.filter(id => !targetUserIds.includes(id)),
    ]
    inviteDraft.value = ''
    inviteOptions.value = []
    selectedInviteUsers.value = []
    invitePickerOpen.value = false
    inviteStatus.value = 'success'
    inviteMessage.value = targetUserIds.length === 1
      ? `已邀请 ${targetUserIds[0]}`
      : `已邀请 ${targetUserIds.length} 位协作者`
  }
  catch {
    inviteStatus.value = 'error'
    inviteMessage.value = '邀请失败，请稍后重试'
  }
}

async function copyLink(): Promise<void> {
  copyError.value = false
  try {
    await navigator.clipboard.writeText(shareLink.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
  catch {
    copyError.value = true
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    role="dialog"
    aria-modal="true"
    @click.self="emit('close')"
  >
    <div class="w-[420px] rounded-lg border border-border bg-popover shadow-xl">
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <div class="min-w-0">
          <h3 class="text-sm font-semibold">
            共享文档
          </h3>
          <p class="mt-0.5 truncate text-xs text-muted-foreground">
            {{ docTitle }}
          </p>
        </div>
        <button
          class="flex size-6 shrink-0 items-center justify-center rounded hover:bg-accent"
          aria-label="关闭"
          @click="emit('close')"
        >
          <X :size="14" />
        </button>
      </div>

      <div class="p-4">
        <form
          data-testid="doc-share-invite-form"
          class="rounded-md border border-border p-3"
          @submit.prevent="inviteCollaborator"
        >
          <div class="flex items-start gap-3">
            <div class="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Users :size="18" class="text-primary" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold">
                邀请协作者
              </p>
              <div class="mt-2 flex items-center gap-2">
                <input
                  v-model="inviteDraft"
                  type="text"
                  data-testid="doc-share-invite-input"
                  placeholder="搜索并选择协作者"
                  class="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                  @focus="invitePickerOpen = true"
                >
                <button
                  type="submit"
                  data-testid="doc-share-invite-submit"
                  class="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  title="邀请"
                  aria-label="邀请"
                  :disabled="!canInvite"
                >
                  <Loader2 v-if="inviteStatus === 'inviting'" :size="14" class="animate-spin" />
                  <Send v-else :size="14" />
                </button>
              </div>
            </div>
          </div>
          <div
            v-if="selectedInviteUsers.length > 0"
            data-testid="doc-share-selected-user"
            class="mt-3 flex flex-wrap gap-1.5 rounded-md bg-primary/10 px-2 py-1.5 text-xs"
          >
            <span
              v-for="user in selectedInviteUsers"
              :key="user.userId"
              class="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full bg-background px-2 py-1"
            >
              <span class="min-w-0 truncate font-semibold text-foreground">{{ user.displayName }}</span>
              <span class="hidden text-muted-foreground sm:inline">{{ user.userId }}</span>
              <button
                type="button"
                class="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                :aria-label="`移除 ${user.displayName}`"
                :data-testid="`doc-share-remove-${user.userId}`"
                @click="clearSelectedInviteUser(user.userId)"
              >
                <X :size="10" />
              </button>
            </span>
          </div>
          <div
            v-if="invitePickerOpen"
            class="mt-3 max-h-44 overflow-y-auto rounded-md border border-border bg-background p-1"
            data-testid="doc-share-options"
          >
            <div
              v-if="searchingInviteUsers && visibleInviteOptions.length === 0"
              class="px-3 py-5 text-center text-xs text-muted-foreground"
            >
              搜索中...
            </div>
            <template v-else-if="visibleInviteOptions.length > 0">
              <button
                v-for="option in visibleInviteOptions"
                :key="option.userId"
                type="button"
                class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-foreground transition-colors hover:bg-accent"
                :data-testid="`doc-share-option-${option.userId}`"
                aria-pressed="false"
                @click="selectInviteUser(option)"
              >
                <span
                  class="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
                  :title="option.userId"
                >
                  {{ option.displayName.charAt(0).toUpperCase() }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-xs font-semibold">{{ option.displayName }}</span>
                  <span class="block truncate text-[11px] text-muted-foreground">
                    {{ option.userId }}
                  </span>
                </span>
                <span
                  v-if="option.source === 'direct'"
                  class="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  ID
                </span>
              </button>
            </template>
            <div
              v-else
              class="px-3 py-5 text-center text-xs text-muted-foreground"
            >
              {{ inviteOptionsEmptyText }}
            </div>
          </div>
          <p
            v-if="inviteMessage"
            data-testid="doc-share-status"
            class="mt-2 text-xs"
            :class="inviteStatus === 'error' ? 'text-destructive' : 'text-green-600 dark:text-green-400'"
          >
            {{ inviteMessage }}
          </p>
          <div
            v-if="invitedUsers.length > 0"
            class="mt-3 flex flex-wrap gap-1.5"
            data-testid="doc-share-invited-users"
          >
            <span
              v-for="userId in invitedUsers"
              :key="userId"
              class="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground"
            >
              {{ userId }}
            </span>
          </div>
        </form>

        <div class="mt-4 rounded-md border border-border p-3">
          <div class="flex items-center gap-2">
            <Users :size="18" class="text-primary" />
            <span class="text-sm font-semibold">访问权限</span>
          </div>
          <p class="mt-2 text-xs leading-5 text-muted-foreground">
            被邀请成员加入文档房间后可实时协作编辑。
          </p>
        </div>

        <div class="mt-4 rounded-md border border-border p-3">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <Link2 :size="14" class="text-muted-foreground" />
              <span class="text-xs font-semibold">文档链接</span>
            </div>
            <button
              class="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold transition-colors hover:bg-accent"
              data-testid="doc-share-copy-link"
              @click="copyLink"
            >
              <component :is="copied ? Check : Copy" :size="12" />
              <span>{{ copied ? '已复制' : '复制' }}</span>
            </button>
          </div>
          <input
            :value="shareLink"
            readonly
            data-testid="doc-share-link-input"
            class="mt-2 h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs text-muted-foreground outline-none focus:border-primary"
            @focus="($event.target as HTMLInputElement).select()"
          >
          <p v-if="copyError" class="mt-2 text-xs text-destructive">
            链接复制失败
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

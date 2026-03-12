<script setup lang="ts">
import { findOrCreateDm } from '@matrix/rooms'
import { Search, Users, X } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useContacts } from '@/features/contacts/composables/useContacts'
import { useGroupManagement } from '@/features/contacts/composables/useGroupManagement'
import { useContactStore } from '@/features/contacts/stores/contactStore'
import { Avatar } from '@/shared/components/ui/avatar'
import { Label } from '@/shared/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { useChatStore } from '../stores/chatStore'

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const router = useRouter()
const store = useChatStore()
const contactStore = useContactStore()
const { searchUsers } = useContacts()

// --- 状态 ---
type Tab = 'dm' | 'group'
const activeTab = ref<Tab>('dm')
const query = ref('')
const loading = ref(false)
const starting = ref(false)

// 用户目录搜索结果
const directoryResults = ref<{ user_id: string, display_name?: string, avatar_url?: string }[]>([])

// 群组创建
const { createGroup } = useGroupManagement()
const groupName = ref('')
const groupTopic = ref('')
const groupInvites = ref('')
const creatingGroup = ref(false)

onMounted(() => {
  contactStore.loadContacts()
})

// --- 搜索逻辑（私聊模式） ---
let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(query, (val) => {
  if (searchTimer)
    clearTimeout(searchTimer)
  if (!val.trim()) {
    directoryResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    loading.value = true
    try {
      directoryResults.value = await searchUsers(val.trim())
    }
    catch {
      directoryResults.value = []
    }
    finally {
      loading.value = false
    }
  }, 300)
})

onUnmounted(() => {
  if (searchTimer)
    clearTimeout(searchTimer)
})

// 合并已有联系人 + 搜索结果（去重）
const dmList = computed(() => {
  const q = query.value.toLowerCase()

  // 无搜索词时，显示已有联系人
  if (!q) {
    return contactStore.contacts.map(c => ({
      userId: c.userId,
      displayName: c.displayName,
      avatarMxc: c.avatarUrl || undefined,
    }))
  }

  // 有搜索词时，合并联系人过滤 + 目录搜索结果
  const seen = new Set<string>()
  const result: { userId: string, displayName: string, avatarMxc?: string }[] = []

  // 先放匹配的已有联系人
  for (const c of contactStore.contacts) {
    if (c.displayName.toLowerCase().includes(q) || c.userId.toLowerCase().includes(q)) {
      seen.add(c.userId)
      result.push({ userId: c.userId, displayName: c.displayName, avatarMxc: c.avatarUrl || undefined })
    }
  }

  // 再放目录搜索结果
  for (const r of directoryResults.value) {
    if (!seen.has(r.user_id)) {
      seen.add(r.user_id)
      result.push({
        userId: r.user_id,
        displayName: r.display_name || r.user_id.split(':')[0].slice(1),
        avatarMxc: r.avatar_url || undefined,
      })
    }
  }

  return result
})

// --- 选择用户开始私聊 ---
async function startDm(userId: string) {
  if (starting.value)
    return
  starting.value = true
  try {
    const roomId = await findOrCreateDm(userId)
    store.setCurrentRoom(roomId)
    router.push(`/chat/${roomId}`)
    emit('close')
  }
  catch {
    toast.error(t('auth.error'))
  }
  finally {
    starting.value = false
  }
}

// --- 创建群组 ---
async function handleCreateGroup() {
  if (!groupName.value.trim() || creatingGroup.value)
    return
  creatingGroup.value = true
  try {
    const userIds = groupInvites.value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    const roomId = await createGroup({
      name: groupName.value,
      topic: groupTopic.value || undefined,
      userIds,
      isEncrypted: false,
    })
    store.setCurrentRoom(roomId)
    router.push(`/chat/${roomId}`)
    emit('close')
  }
  catch {
    toast.error(t('auth.error'))
  }
  finally {
    creatingGroup.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="emit('close')">
      <div class="bg-background border border-border rounded-xl shadow-xl w-[400px] max-h-[520px] flex flex-col overflow-hidden">
        <!-- 标题栏 -->
        <div class="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 class="text-sm font-semibold">
            {{ t('chat.new_chat') }}
          </h3>
          <button class="p-1 rounded-lg hover:bg-accent text-muted-foreground" @click="emit('close')">
            <X :size="16" />
          </button>
        </div>

        <!-- 标签切换 + 内容 -->
        <Tabs v-model="activeTab" class="flex-1 flex flex-col overflow-hidden">
          <div class="px-4 pb-2">
            <TabsList class="grid w-full grid-cols-2">
              <TabsTrigger value="dm">
                {{ t('chat.direct_message') }}
              </TabsTrigger>
              <TabsTrigger value="group" class="flex items-center gap-1">
                <Users :size="12" />
                {{ t('chat.create_group') }}
              </TabsTrigger>
            </TabsList>
          </div>

          <!-- 私聊模式 -->
          <TabsContent value="dm" class="flex-1 flex flex-col overflow-hidden mt-0">
            <!-- 搜索框 -->
            <div class="px-4 pb-2">
              <div class="relative">
                <Search :size="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                <input
                  v-model="query"
                  :placeholder="t('chat.search_user_placeholder')"
                  class="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-muted/30 outline-none focus:ring-1 focus:ring-primary/40 transition-all"
                  autofocus
                >
              </div>
            </div>

            <!-- 用户列表 -->
            <div class="flex-1 overflow-y-auto px-2 pb-2">
              <!-- 加载中 -->
              <div v-if="loading" class="flex items-center justify-center py-8 text-muted-foreground/50">
                <span class="text-sm">{{ t('chat.searching') }}</span>
              </div>

              <!-- 空状态 -->
              <div
                v-else-if="dmList.length === 0 && query"
                class="text-center text-sm text-muted-foreground/50 py-8"
              >
                {{ t('chat.user_not_found') }}
              </div>

              <div
                v-else-if="dmList.length === 0 && !query"
                class="text-center text-sm text-muted-foreground/50 py-8"
              >
                {{ t('chat.search_to_start') }}
              </div>

              <!-- 用户列表 -->
              <button
                v-for="u in dmList"
                :key="u.userId"
                class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left"
                :disabled="starting"
                @click="startDm(u.userId)"
              >
                <Avatar :src="u.avatarMxc" :alt="u.displayName" :color-id="u.userId" size="sm" shape="circle" />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">
                    {{ u.displayName }}
                  </div>
                  <div class="text-[11px] text-muted-foreground truncate">
                    {{ u.userId }}
                  </div>
                </div>
              </button>
            </div>
          </TabsContent>

          <!-- 创建群组模式 -->
          <TabsContent value="group" class="flex-1 overflow-hidden mt-0">
            <div class="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
              <div>
                <Label class="text-[12px] text-muted-foreground mb-1 block">{{ t('chat.group_name') }}</Label>
                <input
                  v-model="groupName"
                  type="text"
                  :placeholder="t('chat.group_name_placeholder')"
                  class="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background outline-none focus:ring-1 focus:ring-primary/40"
                  autofocus
                >
              </div>

              <div>
                <Label class="text-[12px] text-muted-foreground mb-1 block">{{ t('chat.group_topic') }}</Label>
                <input
                  v-model="groupTopic"
                  type="text"
                  :placeholder="t('chat.group_topic_placeholder')"
                  class="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background outline-none focus:ring-1 focus:ring-primary/40"
                >
              </div>

              <div>
                <Label class="text-[12px] text-muted-foreground mb-1 block">{{ t('chat.invite_members') }}</Label>
                <input
                  v-model="groupInvites"
                  type="text"
                  placeholder="@user1:server, @user2:server"
                  class="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background outline-none focus:ring-1 focus:ring-primary/40"
                >
              </div>

              <div class="pt-1 flex justify-end">
                <button
                  class="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground disabled:opacity-50 transition-all"
                  :disabled="!groupName.trim() || creatingGroup"
                  @click="handleCreateGroup"
                >
                  {{ creatingGroup ? t('chat.creating') : t('chat.create_group') }}
                </button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  </Teleport>
</template>

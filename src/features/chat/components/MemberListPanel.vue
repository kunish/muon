<script setup lang="ts">
import { getClient } from '@matrix/client'
import { Search, X, Shield, ShieldCheck, Crown } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChatStore } from '../stores/chatStore'
import { useAuthMedia } from '@/shared/composables/useAuthMedia'
import { fetchMediaBlobUrl } from '@matrix/media'
import { avatarGradient, initials as getInitials } from '../lib/format'

const { t } = useI18n()
const store = useChatStore()
const searchQuery = ref('')

interface MemberInfo {
  userId: string
  displayName: string
  mxcAvatar?: string
  powerLevel: number
  membership: string
  statusMsg?: string
}

const members = computed<MemberInfo[]>(() => {
  const client = getClient()
  const roomId = store.currentRoomId
  if (!roomId) return []

  const room = client.getRoom(roomId)
  if (!room) return []

  const joinedMembers = room.getJoinedMembers()
  return joinedMembers
    .map(m => ({
      userId: m.userId,
      displayName: m.name || m.userId.split(':')[0]?.slice(1) || m.userId,
      mxcAvatar: m.getMxcAvatarUrl() || undefined,
      powerLevel: room.getMember(m.userId)?.powerLevel ?? 0,
      membership: 'join',
      statusMsg: client.getUser(m.userId)?.presenceStatusMsg || undefined,
    }))
    .sort((a, b) => {
      // 管理员排前面
      if (a.powerLevel !== b.powerLevel) return b.powerLevel - a.powerLevel
      return a.displayName.localeCompare(b.displayName)
    })
})

const filteredMembers = computed(() => {
  if (!searchQuery.value.trim()) return members.value
  const q = searchQuery.value.toLowerCase()
  return members.value.filter(m =>
    m.displayName.toLowerCase().includes(q) || m.userId.toLowerCase().includes(q),
  )
})

// 头像缓存
const avatarCache = ref<Record<string, string>>({})

watch(members, async (list) => {
  for (const m of list) {
    if (m.mxcAvatar && m.mxcAvatar.startsWith('mxc://') && !avatarCache.value[m.userId]) {
      const blob = await fetchMediaBlobUrl(m.mxcAvatar, 32, 32)
      if (blob) {
        avatarCache.value = { ...avatarCache.value, [m.userId]: blob }
      }
    }
  }
}, { immediate: true })

function getPowerLevelIcon(level: number) {
  if (level >= 100) return Crown
  if (level >= 50) return ShieldCheck
  if (level > 0) return Shield
  return null
}

function getPowerLevelLabel(level: number) {
  if (level >= 100) return t('chat.role_owner')
  if (level >= 50) return t('chat.role_admin')
  if (level > 0) return t('chat.role_moderator')
  return ''
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
      <span class="font-medium text-sm">{{ t('chat.member_list') }} ({{ members.length }})</span>
      <button
        class="p-1 rounded-md hover:bg-accent text-muted-foreground"
        @click="store.closeSidePanel()"
      >
        <X :size="16" />
      </button>
    </div>

    <!-- Search -->
    <div class="px-3 py-2 shrink-0">
      <div class="relative">
        <Search
          class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40"
          :size="13"
        />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('chat.search_members')"
          class="w-full h-[30px] pl-7.5 pr-3 text-[12px] rounded-lg bg-accent/40 border border-transparent outline-none placeholder:text-muted-foreground/35 transition-all duration-200 focus:bg-accent/70 focus:border-ring/20"
        >
      </div>
    </div>

    <!-- Member list -->
    <div class="flex-1 overflow-y-auto px-2">
      <div
        v-for="member in filteredMembers"
        :key="member.userId"
        class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
      >
        <!-- Avatar -->
        <img
          v-if="avatarCache[member.userId]"
          :src="avatarCache[member.userId]"
          :alt="member.displayName"
          class="w-8 h-8 rounded-full object-cover shrink-0"
        >
        <div
          v-else
          class="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
          :style="{ background: avatarGradient(member.userId) }"
        >
          {{ getInitials(member.displayName) }}
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1">
            <span class="text-sm truncate">{{ member.displayName }}</span>
            <component
              :is="getPowerLevelIcon(member.powerLevel)"
              v-if="getPowerLevelIcon(member.powerLevel)"
              :size="12"
              class="shrink-0"
              :class="member.powerLevel >= 100 ? 'text-yellow-500' : 'text-blue-500'"
              :title="getPowerLevelLabel(member.powerLevel)"
            />
          </div>
          <div class="text-[11px] text-muted-foreground/60 truncate">
            {{ member.userId }}
          </div>
          <div v-if="member.statusMsg" class="text-[10px] text-muted-foreground/50 truncate">
            {{ member.statusMsg }}
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="filteredMembers.length === 0"
        class="flex flex-col items-center justify-center py-8 text-muted-foreground/40"
      >
        <span class="text-xs">{{ searchQuery ? t('chat.no_matching_members') : t('chat.no_members') }}</span>
      </div>
    </div>
  </div>
</template>

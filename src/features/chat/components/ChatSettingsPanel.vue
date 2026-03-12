<script setup lang="ts">
import { getClient } from '@matrix/client'
import { getRoomTopic, leaveRoom, setRoomTopic, toggleRoomMute, toggleRoomPin } from '@matrix/rooms'
import { ask } from '@tauri-apps/plugin-dialog'
import {
  Bell,
  BellOff,
  Check,
  ChevronRight,
  Copy,
  Pin,
  Shield,
  X,
} from 'lucide-vue-next'
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Avatar } from '@/shared/components/ui/avatar'
import { Switch } from '@/shared/components/ui/switch'
import { Textarea } from '@/shared/components/ui/textarea'
import { isDirectRoom } from '@/shared/lib/roomUtils'
import { useChatStore } from '../stores/chatStore'

const { t } = useI18n()
const store = useChatStore()

// ── Room data ───────────────────────────────────────────────

const room = computed(() => {
  const client = getClient()
  return store.currentRoomId ? client.getRoom(store.currentRoomId) : null
})

const roomName = computed(() => room.value?.name || '')

const roomMxcAvatar = computed(() => room.value?.getMxcAvatarUrl() || undefined)

const roomTopic = computed(() => {
  if (!store.currentRoomId)
    return ''
  return getRoomTopic(store.currentRoomId)
})

const isEncrypted = computed(() => {
  if (!room.value)
    return false
  return room.value.hasEncryptionStateEvent()
})

const isDirect = computed(() => store.currentRoomId ? isDirectRoom(store.currentRoomId) : false)

const memberCount = computed(() => room.value?.getJoinedMemberCount() || 0)

const isPinned = computed(() => store.currentRoomId ? store.isPinned(store.currentRoomId) : false)
const isMuted = computed(() => store.currentRoomId ? store.isMuted(store.currentRoomId) : false)

// ── Members preview (top 8) ─────────────────────────────────

interface MemberPreview {
  userId: string
  displayName: string
  mxcAvatar?: string
  powerLevel: number
}

const memberPreviews = computed<MemberPreview[]>(() => {
  if (!room.value)
    return []
  const joinedMembers = room.value.getJoinedMembers()
  return joinedMembers
    .map(m => ({
      userId: m.userId,
      displayName: m.name || m.userId.split(':')[0]?.slice(1) || m.userId,
      mxcAvatar: m.getMxcAvatarUrl() || undefined,
      powerLevel: room.value!.getMember(m.userId)?.powerLevel ?? 0,
    }))
    .sort((a, b) => b.powerLevel - a.powerLevel)
    .slice(0, 8)
})

// ── Actions ─────────────────────────────────────────────────

async function onTogglePin() {
  if (!store.currentRoomId)
    return
  await toggleRoomPin(store.currentRoomId)
  store.togglePin(store.currentRoomId)
}

async function onToggleMute() {
  if (!store.currentRoomId)
    return
  await toggleRoomMute(store.currentRoomId)
  store.toggleMute(store.currentRoomId)
}

async function onLeaveRoom() {
  if (!store.currentRoomId)
    return
  const msg = isDirect.value
    ? t('chat.ctx_leave_dm_msg')
    : t('chat.ctx_leave_group_msg')
  const confirmed = await ask(msg, {
    title: t('chat.ctx_leave_title'),
    kind: 'warning',
  })
  if (!confirmed)
    return
  await leaveRoom(store.currentRoomId)
  store.setCurrentRoom(null)
}

// ── Copy Room ID ────────────────────────────────────────────

const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

async function copyRoomId() {
  if (!store.currentRoomId)
    return
  await navigator.clipboard.writeText(store.currentRoomId)
  copied.value = true
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copied.value = false
  }, 2000)
}

onUnmounted(() => {
  if (copyTimer)
    clearTimeout(copyTimer)
})

// ── Topic editing ───────────────────────────────────────────

const editingTopic = ref(false)
const topicDraft = ref('')

function startEditTopic() {
  topicDraft.value = roomTopic.value
  editingTopic.value = true
}

async function saveTopic() {
  if (!store.currentRoomId)
    return
  await setRoomTopic(store.currentRoomId, topicDraft.value.trim())
  editingTopic.value = false
}

function cancelEditTopic() {
  editingTopic.value = false
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
      <span class="font-medium text-sm">{{ t('chat.room_settings') }}</span>
      <button
        class="p-1 rounded-md hover:bg-accent text-muted-foreground"
        @click="store.closeSidePanel()"
      >
        <X :size="16" />
      </button>
    </div>

    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto">
      <!-- Room info header -->
      <div class="flex items-center gap-3 px-4 py-4">
        <Avatar
          :src="roomMxcAvatar"
          :alt="roomName"
          :color-id="store.currentRoomId || ''"
          size="lg"
          shape="circle"
        />
        <div class="min-w-0 flex-1">
          <div class="font-medium truncate">
            {{ roomName }}
          </div>
          <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 mt-0.5">
            <Shield v-if="isEncrypted" :size="11" class="text-success shrink-0" />
            <span v-if="isEncrypted">{{ t('chat.e2e_encrypted') }}</span>
            <span v-if="isEncrypted && memberCount"> · </span>
            <span>{{ t('chat.member_count', { count: memberCount }) }}</span>
          </div>
        </div>
      </div>

      <!-- Topic -->
      <div v-if="roomTopic || !isDirect" class="px-4 pb-3">
        <template v-if="!editingTopic">
          <p
            v-if="roomTopic"
            class="text-xs text-muted-foreground/70 leading-relaxed cursor-pointer hover:text-muted-foreground transition-colors"
            :title="t('common.edit')"
            @click="startEditTopic"
          >
            {{ roomTopic }}
          </p>
          <button
            v-else-if="!isDirect"
            class="text-xs text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
            @click="startEditTopic"
          >
            {{ t('contacts.group_topic_placeholder') }}
          </button>
        </template>
        <div v-else class="flex flex-col gap-1.5">
          <Textarea
            v-model="topicDraft"
            rows="2"
            class="w-full text-xs rounded-lg bg-accent/40 border border-transparent px-2.5 py-2 outline-none resize-none placeholder:text-muted-foreground/35 transition-all duration-200 focus:bg-accent/70 focus:border-ring/20"
            :placeholder="t('contacts.group_topic_placeholder')"
            @keydown.meta.enter="saveTopic"
          />
          <div class="flex justify-end gap-1.5">
            <button
              class="text-[11px] px-2.5 py-1 rounded-md hover:bg-accent text-muted-foreground"
              @click="cancelEditTopic"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              class="text-[11px] px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              @click="saveTopic"
            >
              {{ t('common.save') }}
            </button>
          </div>
        </div>
      </div>

      <div class="h-px bg-border/50 mx-4" />

      <!-- Members preview -->
      <div class="px-4 py-3">
        <button
          class="flex items-center justify-between w-full group"
          @click="store.toggleSidePanel('members')"
        >
          <span class="text-sm font-medium">{{ t('chat.member_list') }}</span>
          <span class="flex items-center gap-1 text-xs text-muted-foreground/60">
            {{ memberCount }}
            <ChevronRight :size="14" class="group-hover:translate-x-0.5 transition-transform" />
          </span>
        </button>
        <div class="flex items-center gap-1.5 mt-2.5 flex-wrap">
          <template v-for="m in memberPreviews" :key="m.userId">
            <Avatar
              :src="m.mxcAvatar"
              :alt="m.displayName"
              :color-id="m.userId"
              size="sm"
              shape="circle"
            />
          </template>
          <button
            v-if="memberCount > 8"
            class="w-8 h-8 rounded-full bg-accent/60 flex items-center justify-center text-[10px] text-muted-foreground hover:bg-accent transition-colors"
            @click="store.toggleSidePanel('members')"
          >
            +{{ memberCount - 8 }}
          </button>
        </div>
      </div>

      <div class="h-px bg-border/50 mx-4" />

      <!-- Toggle settings -->
      <div class="py-1">
        <!-- Mute notifications -->
        <button
          class="settings-row"
          @click="onToggleMute"
        >
          <span class="flex items-center gap-2.5">
            <BellOff v-if="isMuted" :size="15" class="text-muted-foreground/60" />
            <Bell v-else :size="15" class="text-muted-foreground/60" />
            <span class="text-sm">{{ isMuted ? t('chat.ctx_unmute') : t('chat.ctx_mute') }}</span>
          </span>
          <Switch :checked="isMuted" @update:checked="() => onToggleMute()" />
        </button>

        <!-- Pin to top -->
        <button
          class="settings-row"
          @click="onTogglePin"
        >
          <span class="flex items-center gap-2.5">
            <Pin v-if="isPinned" :size="15" class="text-primary" />
            <Pin v-else :size="15" class="text-muted-foreground/60" />
            <span class="text-sm">{{ isPinned ? t('chat.ctx_unpin') : t('chat.ctx_pin') }}</span>
          </span>
          <Switch :checked="isPinned" @update:checked="() => onTogglePin()" />
        </button>
      </div>

      <div class="h-px bg-border/50 mx-4" />

      <!-- Room ID -->
      <div class="px-4 py-3">
        <div class="text-[11px] text-muted-foreground/40 mb-1">
          {{ t('chat.room_id_label') }}
        </div>
        <button
          class="flex items-center gap-2 group w-full"
          @click="copyRoomId"
        >
          <span class="text-[11px] text-muted-foreground/60 truncate flex-1 text-left font-mono">
            {{ store.currentRoomId }}
          </span>
          <Check v-if="copied" :size="12" class="shrink-0 text-success" />
          <Copy v-else :size="12" class="shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
        </button>
      </div>

      <div class="h-px bg-border/50 mx-4" />

      <!-- Leave room -->
      <div class="px-4 py-3">
        <button
          class="w-full text-sm text-destructive hover:text-destructive/80 text-center py-2 rounded-lg hover:bg-destructive/5 transition-colors"
          @click="onLeaveRoom"
        >
          {{ isDirect ? t('chat.ctx_leave') : t('contacts.leave_group') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 16px;
  cursor: pointer;
  transition: background 0.1s;
}
.settings-row:hover {
  background: var(--color-accent);
}
</style>

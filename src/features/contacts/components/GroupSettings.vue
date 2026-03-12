<script setup lang="ts">
import { getClient } from '@matrix/client'
import { getRoomAnnouncement, getRoomTopic, leaveRoom, setRoomAnnouncement, setRoomName, setRoomTopic } from '@matrix/index'
import { ask } from '@tauri-apps/plugin-dialog'
import {
  Check,
  LogOut,
  Megaphone,
  Pencil,
  Shield,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Textarea } from '@/shared/components/ui/textarea'
import { useConversations } from '../../chat/composables/useConversations'
import { useChatStore } from '../../chat/stores/chatStore'
import { useGroupManagement } from '../composables/useGroupManagement'

const props = defineProps<{
  roomId: string
}>()

const emit = defineEmits<{
  leave: []
}>()

const { t } = useI18n()
const { inviteUser, kickUser, setUserPowerLevel } = useGroupManagement()
const { removeRoom } = useConversations()
const chatStore = useChatStore()

const client = getClient()
const room = computed(() => client.getRoom(props.roomId))
const members = computed(() => room.value?.getJoinedMembers() || [])
const myUserId = client.getUserId()!

const inviteId = ref('')
const showInvite = ref(false)

// --- 群名称编辑 ---
const editingName = ref(false)
const nameInput = ref('')

function startEditName() {
  nameInput.value = room.value?.name || ''
  editingName.value = true
}

async function saveName() {
  const name = nameInput.value.trim()
  if (!name || name === room.value?.name) {
    editingName.value = false
    return
  }
  await setRoomName(props.roomId, name)
  editingName.value = false
}

// --- 群话题/描述编辑 ---
const editingTopic = ref(false)
const topicInput = ref('')
const currentTopic = computed(() => getRoomTopic(props.roomId))

function startEditTopic() {
  topicInput.value = currentTopic.value
  editingTopic.value = true
}

async function saveTopic() {
  if (topicInput.value.trim() === currentTopic.value) {
    editingTopic.value = false
    return
  }
  await setRoomTopic(props.roomId, topicInput.value.trim())
  editingTopic.value = false
}

// --- 群公告 ---
const editingAnnouncement = ref(false)
const announcementInput = ref('')
const currentAnnouncement = computed(() => getRoomAnnouncement(props.roomId))

function startEditAnnouncement() {
  announcementInput.value = currentAnnouncement.value
  editingAnnouncement.value = true
}

async function saveAnnouncement() {
  if (announcementInput.value.trim() === currentAnnouncement.value) {
    editingAnnouncement.value = false
    return
  }
  await setRoomAnnouncement(props.roomId, announcementInput.value.trim())
  editingAnnouncement.value = false
}

// --- 退出/解散群组 ---
async function handleLeave() {
  const confirmed = await ask(t('contacts.leave_confirm'), {
    title: t('contacts.leave_group'),
    kind: 'warning',
  })
  if (!confirmed)
    return
  try {
    await leaveRoom(props.roomId)
    if (chatStore.currentRoomId === props.roomId) {
      chatStore.setCurrentRoom(null)
    }
    removeRoom(props.roomId)
    emit('leave')
  }
  catch {
    toast.error(t('auth.error'))
  }
}

async function handleInvite() {
  if (!inviteId.value.trim())
    return
  await inviteUser(props.roomId, inviteId.value.trim())
  inviteId.value = ''
  showInvite.value = false
}

function getPowerLevel(userId: string): number {
  const plEvent = room.value?.currentState.getStateEvents('m.room.power_levels', '')
  return plEvent?.getContent()?.users?.[userId] || 0
}

function getRoleLabel(level: number): string {
  if (level >= 100)
    return t('contacts.role_owner')
  if (level >= 50)
    return t('contacts.role_admin')
  return t('contacts.role_member')
}

const isAdmin = computed(() => getPowerLevel(myUserId) >= 50)
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- 群名称 -->
    <div v-if="room">
      <div v-if="!editingName" class="flex items-center gap-2 group">
        <h3 class="font-medium">
          {{ room.name }}
        </h3>
        <button
          v-if="isAdmin"
          class="p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
          @click="startEditName"
        >
          <Pencil :size="12" />
        </button>
      </div>
      <div v-else class="flex items-center gap-2">
        <input
          v-model="nameInput"
          class="flex-1 h-8 px-2 text-sm font-medium rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
          @keydown.enter="saveName"
          @keydown.escape="editingName = false"
        >
        <button class="p-1 rounded hover:bg-accent text-primary" @click="saveName">
          <Check :size="14" />
        </button>
        <button class="p-1 rounded hover:bg-accent" @click="editingName = false">
          <X :size="14" />
        </button>
      </div>
      <p class="text-xs text-muted-foreground mt-0.5">
        {{ t('contacts.members_count', { count: members.length }) }}
      </p>
    </div>

    <!-- 群描述/话题 -->
    <div>
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-medium text-muted-foreground">{{ t('contacts.group_desc') }}</span>
        <button
          v-if="isAdmin && !editingTopic"
          class="p-1 rounded hover:bg-accent text-muted-foreground"
          @click="startEditTopic"
        >
          <Pencil :size="11" />
        </button>
      </div>
      <div v-if="editingTopic" class="space-y-1.5">
        <Textarea
          v-model="topicInput"
          rows="2"
          class="w-full px-2 py-1.5 text-sm rounded border border-border bg-background outline-none resize-none focus:ring-1 focus:ring-primary"
          :placeholder="t('contacts.group_desc_placeholder')"
          @keydown.escape="editingTopic = false"
        />
        <div class="flex justify-end gap-1">
          <button class="px-2 py-1 text-xs rounded hover:bg-accent" @click="editingTopic = false">
            {{ t('common.cancel') }}
          </button>
          <button class="px-2 py-1 text-xs rounded bg-primary text-primary-foreground" @click="saveTopic">
            {{ t('common.save') }}
          </button>
        </div>
      </div>
      <p v-else class="text-sm text-muted-foreground">
        {{ currentTopic || t('contacts.no_desc') }}
      </p>
    </div>

    <!-- 群公告 -->
    <div>
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Megaphone :size="12" />
          <span>{{ t('contacts.announcement') }}</span>
        </div>
        <button
          v-if="isAdmin && !editingAnnouncement"
          class="p-1 rounded hover:bg-accent text-muted-foreground"
          @click="startEditAnnouncement"
        >
          <Pencil :size="11" />
        </button>
      </div>
      <div v-if="editingAnnouncement" class="space-y-1.5">
        <Textarea
          v-model="announcementInput"
          rows="3"
          class="w-full px-2 py-1.5 text-sm rounded border border-border bg-background outline-none resize-none focus:ring-1 focus:ring-primary"
          :placeholder="t('contacts.announcement_placeholder')"
          @keydown.escape="editingAnnouncement = false"
        />
        <div class="flex justify-end gap-1">
          <button class="px-2 py-1 text-xs rounded hover:bg-accent" @click="editingAnnouncement = false">
            {{ t('common.cancel') }}
          </button>
          <button class="px-2 py-1 text-xs rounded bg-primary text-primary-foreground" @click="saveAnnouncement">
            {{ t('contacts.publish') }}
          </button>
        </div>
      </div>
      <div v-else-if="currentAnnouncement" class="text-sm p-2 rounded-lg bg-warning/5 border border-warning/10">
        {{ currentAnnouncement }}
      </div>
      <p v-else class="text-sm text-muted-foreground">
        {{ t('contacts.no_announcement') }}
      </p>
    </div>

    <div>
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium">{{ t('contacts.members') }}</span>
        <button
          v-if="isAdmin"
          class="p-1 rounded hover:bg-accent text-primary"
          @click="showInvite = !showInvite"
        >
          <UserPlus :size="14" />
        </button>
      </div>

      <div v-if="showInvite" class="flex gap-2 mb-2">
        <input
          v-model="inviteId"
          placeholder="@user:server"
          class="flex-1 h-8 px-2 text-sm rounded border border-border bg-background outline-none"
        >
        <button
          class="px-3 h-8 text-xs rounded bg-primary text-primary-foreground"
          @click="handleInvite"
        >
          {{ t('contacts.invite') }}
        </button>
      </div>

      <div class="space-y-1">
        <div
          v-for="member in members"
          :key="member.userId"
          class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50"
        >
          <div class="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">
            {{ (member.name || member.userId).slice(0, 1) }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm truncate">
              {{ member.name || member.userId }}
            </div>
          </div>
          <span class="text-xs text-muted-foreground">
            {{ getRoleLabel(getPowerLevel(member.userId)) }}
          </span>
          <template v-if="isAdmin && member.userId !== myUserId">
            <button
              class="p-1 rounded hover:bg-accent"
              :title="t('contacts.set_admin')"
              @click="setUserPowerLevel(roomId, member.userId, 50)"
            >
              <Shield :size="12" />
            </button>
            <button
              class="p-1 rounded hover:bg-accent text-destructive"
              :title="t('contacts.remove_member')"
              @click="kickUser(roomId, member.userId)"
            >
              <UserMinus :size="12" />
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- 退出群组 -->
    <div class="pt-2 border-t border-border">
      <button
        class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
        @click="handleLeave"
      >
        <LogOut :size="14" />
        <span>{{ t('contacts.leave_group') }}</span>
      </button>
    </div>
  </div>
</template>

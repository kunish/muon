<script setup lang="ts">
import { getClient } from '@matrix/client'
import { Shield, UserMinus, UserPlus } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useGroupManagement } from '../composables/useGroupManagement'

const props = defineProps<{
  roomId: string
}>()

const { inviteUser, kickUser, setUserPowerLevel } = useGroupManagement()

const client = getClient()
const room = computed(() => client.getRoom(props.roomId))
const members = computed(() => room.value?.getJoinedMembers() || [])
const myUserId = client.getUserId()!

const inviteId = ref('')
const showInvite = ref(false)

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
    return '群主'
  if (level >= 50)
    return '管理员'
  return '成员'
}

const isAdmin = computed(() => getPowerLevel(myUserId) >= 50)
</script>

<template>
  <div class="p-4 space-y-4">
    <div v-if="room">
      <h3 class="font-medium mb-1">
        {{ room.name }}
      </h3>
      <p class="text-xs text-muted-foreground">
        {{ members.length }} 位成员
      </p>
    </div>

    <div>
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium">成员</span>
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
          邀请
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
              title="设为管理员"
              @click="setUserPowerLevel(roomId, member.userId, 50)"
            >
              <Shield :size="12" />
            </button>
            <button
              class="p-1 rounded hover:bg-accent text-destructive"
              title="移除"
              @click="kickUser(roomId, member.userId)"
            >
              <UserMinus :size="12" />
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

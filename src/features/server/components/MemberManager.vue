<script setup lang="ts">
import type { SpaceMember } from '@/matrix/spaces'
import { Search, ShieldAlert, UserX } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { getClient } from '@/matrix/client'
import { getSpaceMembers, setSpacePowerLevel } from '@/matrix/spaces'
import Avatar from '@/shared/components/ui/avatar.vue'
import Button from '@/shared/components/ui/button.vue'
import Dialog from '@/shared/components/ui/dialog.vue'
import Input from '@/shared/components/ui/input.vue'

const props = defineProps<{
  serverId: string
}>()

// ── Role definitions (matching MemberPanel) ──

interface RoleOption {
  label: string
  powerLevel: number
  color: string
}

const roleOptions: RoleOption[] = [
  { label: 'Owner', powerLevel: 100, color: '#f0b132' },
  { label: 'Admin', powerLevel: 75, color: '#e8594f' },
  { label: 'Moderator', powerLevel: 50, color: '#3ba55c' },
  { label: 'Member', powerLevel: 0, color: 'var(--color-muted-foreground)' },
]

function getRoleForPowerLevel(level: number): RoleOption {
  if (level >= 100)
    return roleOptions[0]
  if (level >= 75)
    return roleOptions[1]
  if (level >= 50)
    return roleOptions[2]
  return roleOptions[3]
}

// ── State ──

const members = ref<SpaceMember[]>([])
const searchQuery = ref('')
const isChangingRole = ref<string | null>(null)

// Confirm dialogs
const kickTarget = ref<SpaceMember | null>(null)
const showKickDialog = ref(false)
const isKicking = ref(false)

const banTarget = ref<SpaceMember | null>(null)
const showBanDialog = ref(false)
const isBanning = ref(false)

// Current user for permission checks
const myUserId = computed(() => {
  try {
    return getClient().getUserId()
  }
  catch {
    return null
  }
})

const myPowerLevel = computed(() => {
  const me = members.value.find(m => m.userId === myUserId.value)
  return me?.powerLevel ?? 0
})

// ── Filtered list ──

const filteredMembers = computed(() => {
  if (!searchQuery.value.trim())
    return members.value
  const q = searchQuery.value.toLowerCase()
  return members.value.filter(
    m => m.displayName.toLowerCase().includes(q) || m.userId.toLowerCase().includes(q),
  )
})

// ── Load ──

function loadMembers() {
  members.value = getSpaceMembers(props.serverId)
}

// ── Resolve avatar URL ──

function resolveAvatar(mxcUrl?: string): string | undefined {
  if (!mxcUrl)
    return undefined
  try {
    return getClient().mxcUrlToHttp(mxcUrl, 40, 40, 'crop') ?? undefined
  }
  catch {
    return undefined
  }
}

// ── Role change ──

async function changeRole(member: SpaceMember, newLevel: number) {
  if (isChangingRole.value)
    return
  isChangingRole.value = member.userId

  try {
    await setSpacePowerLevel(props.serverId, member.userId, newLevel)
    loadMembers()
  }
  catch (err) {
    console.error('Failed to change role:', err)
  }
  finally {
    isChangingRole.value = null
  }
}

// ── Kick ──

function confirmKick(member: SpaceMember) {
  kickTarget.value = member
  showKickDialog.value = true
}

async function handleKick() {
  if (!kickTarget.value || isKicking.value)
    return
  isKicking.value = true

  try {
    const client = getClient()
    await client.kick(props.serverId, kickTarget.value.userId, 'Kicked by admin')
    loadMembers()
    showKickDialog.value = false
    kickTarget.value = null
  }
  catch (err) {
    console.error('Failed to kick member:', err)
  }
  finally {
    isKicking.value = false
  }
}

// ── Ban ──

function confirmBan(member: SpaceMember) {
  banTarget.value = member
  showBanDialog.value = true
}

async function handleBan() {
  if (!banTarget.value || isBanning.value)
    return
  isBanning.value = true

  try {
    const client = getClient()
    await client.ban(props.serverId, banTarget.value.userId, 'Banned by admin')
    loadMembers()
    showBanDialog.value = false
    banTarget.value = null
  }
  catch (err) {
    console.error('Failed to ban member:', err)
  }
  finally {
    isBanning.value = false
  }
}

onMounted(loadMembers)
</script>

<template>
  <div>
    <h2 class="mb-5 text-xl font-bold text-foreground">
      Members
    </h2>

    <!-- Search -->
    <div class="relative mb-4">
      <Search
        :size="14"
        class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40"
      />
      <Input
        v-model="searchQuery"
        placeholder="Search members"
        class="pl-9"
      />
    </div>

    <!-- Member count -->
    <div class="mb-3 text-xs text-muted-foreground/50">
      {{ filteredMembers.length }} member{{ filteredMembers.length !== 1 ? 's' : '' }}
    </div>

    <!-- Member table -->
    <div v-if="filteredMembers.length > 0">
      <!-- Header -->
      <div class="mb-1 flex items-center gap-3 px-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground/40">
        <div class="w-10" />
        <div class="flex-1">
          Name
        </div>
        <div class="w-28">
          Role
        </div>
        <div class="w-28 text-right">
          Actions
        </div>
      </div>

      <!-- Rows -->
      <div class="space-y-0.5">
        <div
          v-for="member in filteredMembers"
          :key="member.userId"
          class="group flex items-center gap-3 rounded-[4px] px-2 py-2 transition-colors hover:bg-accent/15"
        >
          <!-- Avatar -->
          <Avatar
            :src="resolveAvatar(member.avatarUrl)"
            :alt="member.displayName"
            :fallback="member.displayName.charAt(0)"
            size="sm"
          />

          <!-- Name -->
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium text-foreground/90">
              {{ member.displayName }}
            </div>
            <div class="truncate text-xs text-muted-foreground/40">
              {{ member.userId }}
            </div>
          </div>

          <!-- Role select -->
          <div class="w-28">
            <select
              :value="getRoleForPowerLevel(member.powerLevel).powerLevel"
              :disabled="
                member.userId === myUserId
                  || member.powerLevel >= myPowerLevel
                  || isChangingRole === member.userId
              "
              class="w-full cursor-pointer rounded-md border border-transparent bg-transparent px-2 py-1 text-xs transition-colors hover:border-border focus:border-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              :style="{ color: getRoleForPowerLevel(member.powerLevel).color }"
              @change="changeRole(member, Number(($event.target as HTMLSelectElement).value))"
            >
              <option
                v-for="role in roleOptions"
                :key="role.powerLevel"
                :value="role.powerLevel"
                class="bg-popover text-foreground"
              >
                {{ role.label }}
              </option>
            </select>
          </div>

          <!-- Actions -->
          <div class="flex w-28 items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              v-if="member.userId !== myUserId && member.powerLevel < myPowerLevel"
              class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
              title="Kick"
              @click="confirmKick(member)"
            >
              <UserX :size="14" />
            </button>
            <button
              v-if="member.userId !== myUserId && member.powerLevel < myPowerLevel"
              class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
              title="Ban"
              @click="confirmBan(member)"
            >
              <ShieldAlert :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="py-16 text-center">
      <p class="text-sm text-muted-foreground">
        {{ searchQuery ? 'No matching members' : 'No members found' }}
      </p>
    </div>

    <!-- Kick confirmation dialog -->
    <Dialog v-model:open="showKickDialog">
      <div class="space-y-4">
        <div>
          <h3 class="text-lg font-bold text-foreground">
            Kick Member
          </h3>
          <p class="mt-2 text-sm text-muted-foreground">
            Are you sure you want to kick
            <strong class="text-foreground">{{ kickTarget?.displayName }}</strong>
            from this server? They will be able to rejoin with an invite.
          </p>
        </div>
        <div class="flex justify-end gap-2">
          <Button variant="ghost" @click="showKickDialog = false">
            Cancel
          </Button>
          <Button
            variant="destructive"
            :disabled="isKicking"
            @click="handleKick"
          >
            {{ isKicking ? 'Kicking...' : 'Kick' }}
          </Button>
        </div>
      </div>
    </Dialog>

    <!-- Ban confirmation dialog -->
    <Dialog v-model:open="showBanDialog">
      <div class="space-y-4">
        <div>
          <h3 class="text-lg font-bold text-foreground">
            Ban Member
          </h3>
          <p class="mt-2 text-sm text-muted-foreground">
            Are you sure you want to ban
            <strong class="text-foreground">{{ banTarget?.displayName }}</strong>
            from this server? They will not be able to rejoin unless unbanned.
          </p>
        </div>
        <div class="flex justify-end gap-2">
          <Button variant="ghost" @click="showBanDialog = false">
            Cancel
          </Button>
          <Button
            variant="destructive"
            :disabled="isBanning"
            @click="handleBan"
          >
            {{ isBanning ? 'Banning...' : 'Ban' }}
          </Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { Plus, Save, Trash2 } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { getClient } from '@/matrix/client'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Separator } from '@/shared/components/ui/separator'

const props = defineProps<{
  serverId: string
}>()

// ── Types ──

interface Role {
  id: string
  name: string
  color: string
  powerLevel: number
  isDefault: boolean
}

// Preset colors for role color picker
const presetColors = [
  '#c08b2e', // amber
  '#b85c4a', // terracotta
  '#a0524a', // brick
  '#d4a84a', // warm gold
  '#4a9882', // sage
  '#4a7a6a', // dark sage
  '#6b88a0', // steel blue
  '#5a7a9a', // slate blue
  '#8b6fb0', // lavender
  '#b06878', // dusty rose
  '#a0785c', // sienna
  '#7a8f52', // olive
  '#8a8580', // warm gray
  '#e8e4df', // off-white
  '#6a6560', // dark warm gray
]

const DEFAULT_ROLES: Omit<Role, 'id'>[] = [
  { name: 'Owner', color: '#c08b2e', powerLevel: 100, isDefault: true },
  { name: 'Admin', color: '#b85c4a', powerLevel: 75, isDefault: true },
  { name: 'Moderator', color: '#4a9882', powerLevel: 50, isDefault: true },
  { name: 'Member', color: '#8a8580', powerLevel: 0, isDefault: true },
]

// ── State ──

const roles = ref<Role[]>([])
const selectedRoleId = ref<string | null>(null)
const isSaving = ref(false)
const isDeleting = ref(false)
const saveError = ref('')

// Edited fields for the selected role
const editName = ref('')
const editColor = ref('')
const editPowerLevel = ref(0)

// ── Load roles from Space state event ──

function loadRoles() {
  const client = getClient()
  const room = client.getRoom(props.serverId)
  if (!room)
    return

  const rolesEvent = room.currentState.getStateEvents('im.muon.roles' as any, '')
  const content = rolesEvent?.getContent()

  if (content?.roles && Array.isArray(content.roles)) {
    roles.value = content.roles.map((r: any, idx: number) => ({
      id: r.id || `role_${idx}`,
      name: r.name || 'Unnamed',
      color: r.color || '#8a8580',
      powerLevel: r.powerLevel ?? 0,
      isDefault: r.isDefault ?? false,
    }))
  }
  else {
    // Initialize with defaults
    roles.value = DEFAULT_ROLES.map((r, idx) => ({
      ...r,
      id: `role_${idx}`,
    }))
  }

  // Select first role if none selected
  if (!selectedRoleId.value && roles.value.length > 0) {
    selectRole(roles.value[0].id)
  }
}

function selectRole(roleId: string) {
  selectedRoleId.value = roleId
  const role = roles.value.find(r => r.id === roleId)
  if (role) {
    editName.value = role.name
    editColor.value = role.color
    editPowerLevel.value = role.powerLevel
  }
}

function addRole() {
  const newRole: Role = {
    id: `role_${Date.now()}`,
    name: 'New Role',
    color: '#c08b2e',
    powerLevel: 1,
    isDefault: false,
  }
  roles.value = [...roles.value, newRole]
  selectRole(newRole.id)
}

async function saveRole() {
  if (!selectedRoleId.value || isSaving.value)
    return
  isSaving.value = true
  saveError.value = ''

  try {
    // Update local state
    roles.value = roles.value.map(r =>
      r.id === selectedRoleId.value
        ? { ...r, name: editName.value.trim(), color: editColor.value, powerLevel: editPowerLevel.value }
        : r,
    )

    // Persist to Matrix custom state event
    const client = getClient()
    await client.sendStateEvent(props.serverId, 'im.muon.roles' as any, {
      roles: roles.value.map(r => ({
        id: r.id,
        name: r.name,
        color: r.color,
        powerLevel: r.powerLevel,
        isDefault: r.isDefault,
      })),
    })
  }
  catch (err: any) {
    saveError.value = err?.message || 'Failed to save role'
  }
  finally {
    isSaving.value = false
  }
}

async function deleteRole() {
  if (!selectedRoleId.value || isDeleting.value)
    return
  const role = roles.value.find(r => r.id === selectedRoleId.value)
  if (!role || role.isDefault)
    return

  isDeleting.value = true
  try {
    roles.value = roles.value.filter(r => r.id !== selectedRoleId.value)

    const client = getClient()
    await client.sendStateEvent(props.serverId, 'im.muon.roles' as any, {
      roles: roles.value.map(r => ({
        id: r.id,
        name: r.name,
        color: r.color,
        powerLevel: r.powerLevel,
        isDefault: r.isDefault,
      })),
    })

    // Select first remaining role
    if (roles.value.length > 0) {
      selectRole(roles.value[0].id)
    }
    else {
      selectedRoleId.value = null
    }
  }
  catch (err: any) {
    saveError.value = err?.message || 'Failed to delete role'
  }
  finally {
    isDeleting.value = false
  }
}

onMounted(loadRoles)
</script>

<template>
  <div>
    <div class="mb-5 flex items-center justify-between">
      <h2 class="text-xl font-bold text-foreground">
        Roles
      </h2>
      <Button size="sm" @click="addRole">
        <Plus :size="16" class="mr-1.5" />
        Create Role
      </Button>
    </div>

    <div class="flex gap-6">
      <!-- Role list -->
      <div class="w-[200px] shrink-0 space-y-0.5">
        <button
          v-for="role in roles"
          :key="role.id"
          class="flex w-full items-center gap-2.5 rounded-[4px] px-3 py-2 text-sm transition-colors"
          :class="
            selectedRoleId === role.id
              ? 'bg-accent/40 text-foreground'
              : 'text-muted-foreground hover:bg-accent/20 hover:text-foreground'
          "
          @click="selectRole(role.id)"
        >
          <span
            class="h-3 w-3 shrink-0 rounded-full"
            :style="{ backgroundColor: role.color }"
          />
          <span class="truncate">{{ role.name }}</span>
          <span
            v-if="role.isDefault"
            class="ml-auto text-[10px] text-muted-foreground/50"
          >
            default
          </span>
        </button>
      </div>

      <!-- Role editor -->
      <div v-if="selectedRoleId" class="flex-1">
        <div class="space-y-5">
          <!-- Role Name -->
          <div class="space-y-2">
            <Label class="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Role Name
            </Label>
            <Input
              v-model="editName"
              placeholder="Role name"
            />
          </div>

          <!-- Role Color -->
          <div class="space-y-2">
            <Label class="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Role Color
            </Label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in presetColors"
                :key="color"
                class="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
                :class="editColor === color ? 'border-white scale-110' : 'border-transparent'"
                :style="{ backgroundColor: color }"
                @click="editColor = color"
              />
              <!-- Custom color input -->
              <Label
                class="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 transition-colors hover:border-muted-foreground/60"
              >
                <input
                  v-model="editColor"
                  type="color"
                  class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                >
                <span class="text-xs text-muted-foreground">+</span>
              </Label>
            </div>
            <div class="flex items-center gap-2">
              <span
                class="h-4 w-4 rounded-full"
                :style="{ backgroundColor: editColor }"
              />
              <span class="text-xs text-muted-foreground font-mono">{{ editColor }}</span>
            </div>
          </div>

          <!-- Power Level -->
          <div class="space-y-2">
            <Label class="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Power Level — {{ editPowerLevel }}
            </Label>
            <div class="flex items-center gap-3">
              <span class="text-xs text-muted-foreground/50">0</span>
              <input
                v-model.number="editPowerLevel"
                type="range"
                min="0"
                max="100"
                class="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              >
              <span class="text-xs text-muted-foreground/50">100</span>
            </div>
            <p class="text-xs text-muted-foreground">
              Higher levels can manage users at lower levels. Owner = 100, Admin = 75, Moderator = 50.
            </p>
          </div>

          <Separator />

          <!-- Error -->
          <p v-if="saveError" class="text-sm text-destructive">
            {{ saveError }}
          </p>

          <!-- Actions -->
          <div class="flex gap-2">
            <Button size="sm" :disabled="isSaving || !editName.trim()" @click="saveRole">
              <Save :size="14" class="mr-1.5" />
              {{ isSaving ? 'Saving...' : 'Save' }}
            </Button>
            <Button
              v-if="!roles.find(r => r.id === selectedRoleId)?.isDefault"
              variant="destructive"
              size="sm"
              :disabled="isDeleting"
              @click="deleteRole"
            >
              <Trash2 :size="14" class="mr-1.5" />
              {{ isDeleting ? 'Deleting...' : 'Delete' }}
            </Button>
          </div>
        </div>
      </div>

      <!-- No selection state -->
      <div v-else class="flex flex-1 items-center justify-center py-16">
        <p class="text-sm text-muted-foreground">
          Select a role to edit
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getMyAvatarUrl, getMyDisplayName, getMyStatus, setMyAvatar, setMyDisplayName } from '@matrix/index'
import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { Camera, Check, Pencil, SmilePlus, X } from 'lucide-vue-next'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Label } from '@/shared/components/ui/label'
import { useAuthMedia } from '@/shared/composables/useAuthMedia'
import StatusPicker from './StatusPicker.vue'

const { t } = useI18n()
const displayName = ref(getMyDisplayName())
const mxcAvatar = ref(getMyAvatarUrl())
const avatarUrl = useAuthMedia(mxcAvatar, 96, 96)
const editingName = ref(false)
const nameInput = ref('')
const saving = ref(false)
const currentStatus = ref(getMyStatus())
const showStatusPicker = ref(false)

function onStatusUpdated(status: string) {
  currentStatus.value = status
}

function startEditName() {
  nameInput.value = displayName.value
  editingName.value = true
}

async function saveName() {
  const name = nameInput.value.trim()
  if (!name || name === displayName.value) {
    editingName.value = false
    return
  }
  saving.value = true
  try {
    await setMyDisplayName(name)
    displayName.value = name
  }
  finally {
    saving.value = false
    editingName.value = false
  }
}

async function changeAvatar() {
  const path = await open({
    multiple: false,
    filters: [{ name: t('settings.filter_image'), extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
  })
  if (!path)
    return

  saving.value = true
  try {
    const bytes = await readFile(path)
    const ext = path.split('.').pop()?.toLowerCase() || 'png'
    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
    }
    const file = new File([bytes], `avatar.${ext}`, { type: mimeMap[ext] || 'image/png' })
    await setMyAvatar(file)
    // 本地预览用 blob URL，useAuthMedia 会直接透传非 mxc URL
    mxcAvatar.value = URL.createObjectURL(file)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-lg font-semibold">
      {{ t('settings.profile_title') }}
    </h2>

    <!-- 头像 -->
    <div class="flex items-center gap-4">
      <div class="relative group cursor-pointer" @click="changeAvatar">
        <img
          v-if="avatarUrl"
          :src="avatarUrl"
          class="w-16 h-16 rounded-xl object-cover"
        >
        <div
          v-else
          class="w-16 h-16 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xl font-semibold"
        >
          {{ displayName.slice(0, 1).toUpperCase() }}
        </div>
        <div class="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Camera :size="20" class="text-white" />
        </div>
      </div>
      <div>
        <p class="text-sm font-medium">
          {{ t('settings.avatar_hint') }}
        </p>
        <p class="text-xs text-muted-foreground">
          {{ t('settings.avatar_format') }}
        </p>
      </div>
    </div>

    <!-- 昵称 -->
    <div>
      <Label class="text-sm font-medium text-muted-foreground mb-1.5 block">{{ t('settings.nickname') }}</Label>
      <div v-if="!editingName" class="flex items-center gap-2 group">
        <span class="text-sm">{{ displayName }}</span>
        <button
          class="p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
          @click="startEditName"
        >
          <Pencil :size="12" />
        </button>
      </div>
      <div v-else class="flex items-center gap-2">
        <input
          v-model="nameInput"
          class="flex-1 h-8 px-2 text-sm rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
          @keydown.enter="saveName"
          @keydown.escape="editingName = false"
        >
        <button class="p-1 rounded hover:bg-accent text-primary" :disabled="saving" @click="saveName">
          <Check :size="14" />
        </button>
        <button class="p-1 rounded hover:bg-accent" @click="editingName = false">
          <X :size="14" />
        </button>
      </div>
    </div>

    <!-- 自定义状态 -->
    <div>
      <Label class="text-sm font-medium text-muted-foreground mb-1.5 block">{{ t('settings.status') }}</Label>
      <div class="relative">
        <button
          class="flex items-center gap-2 group text-sm text-muted-foreground hover:text-foreground transition-colors"
          @click="showStatusPicker = !showStatusPicker"
        >
          <SmilePlus :size="14" class="opacity-60 group-hover:opacity-100" />
          <span v-if="currentStatus" class="truncate max-w-[240px]">{{ currentStatus }}</span>
          <span v-else class="italic opacity-60">{{ t('settings.status_placeholder') }}</span>
        </button>
        <!-- StatusPicker Popover -->
        <div
          v-if="showStatusPicker"
          class="absolute left-0 top-full mt-2 z-50 bg-popover/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
        >
          <StatusPicker
            @close="showStatusPicker = false"
            @updated="onStatusUpdated"
          />
        </div>
      </div>
    </div>
  </div>
</template>

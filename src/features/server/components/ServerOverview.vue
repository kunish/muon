<script setup lang="ts">
import { Camera } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useServerStore } from '@/features/server/stores/serverStore'
import { getClient } from '@/matrix/client'
import { setRoomName, setRoomTopic } from '@/matrix/rooms'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'

const props = defineProps<{
  serverId: string
  serverName: string
  serverTopic?: string
  serverAvatar?: string
}>()

const serverStore = useServerStore()
const { t } = useI18n()

const name = ref(props.serverName)
const topic = ref(props.serverTopic ?? '')
const isSaving = ref(false)
const saveError = ref('')

// Reset when props change
watch(
  () => [props.serverName, props.serverTopic],
  () => {
    name.value = props.serverName
    topic.value = props.serverTopic ?? ''
  },
)

const isDirty = computed(() => {
  return name.value !== props.serverName || topic.value !== (props.serverTopic ?? '')
})

function resetChanges() {
  name.value = props.serverName
  topic.value = props.serverTopic ?? ''
  saveError.value = ''
}

async function saveChanges() {
  if (!isDirty.value || isSaving.value)
    return
  isSaving.value = true
  saveError.value = ''

  try {
    if (name.value !== props.serverName) {
      await setRoomName(props.serverId, name.value.trim())
    }
    if (topic.value !== (props.serverTopic ?? '')) {
      await setRoomTopic(props.serverId, topic.value.trim())
    }
    // Refresh server data
    serverStore.loadServers()
    if (serverStore.currentServerId) {
      serverStore.loadChannelTree(serverStore.currentServerId)
    }
  }
  catch (err: unknown) {
    saveError.value = err instanceof Error ? err.message : 'Failed to save changes'
  }
  finally {
    isSaving.value = false
  }
}

// Avatar upload
const avatarInput = ref<HTMLInputElement | null>(null)
const avatarPreview = ref<string | null>(null)
const isUploadingAvatar = ref(false)

function triggerAvatarUpload() {
  avatarInput.value?.click()
}

async function handleAvatarChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return

  isUploadingAvatar.value = true
  try {
    // Show preview immediately
    avatarPreview.value = URL.createObjectURL(file)

    // Upload to Matrix
    const client = getClient()
    const { content_uri } = await client.uploadContent(file) as any
    await client.sendStateEvent(props.serverId, 'm.room.avatar' as any, { url: content_uri })

    serverStore.loadServers()
  }
  catch (err) {
    console.error('Failed to upload avatar:', err)
    toast.error(t('auth.error'))
    avatarPreview.value = null
  }
  finally {
    isUploadingAvatar.value = false
  }
}

// Resolve MXC avatar URL for display
const resolvedAvatar = computed(() => {
  if (avatarPreview.value)
    return avatarPreview.value
  if (!props.serverAvatar)
    return null
  try {
    const client = getClient()
    return client.mxcUrlToHttp(props.serverAvatar, 128, 128, 'crop') ?? null
  }
  catch {
    return null
  }
})
</script>

<template>
  <div>
    <h2 class="mb-5 text-xl font-bold text-foreground">
      Server Overview
    </h2>

    <div class="flex gap-8">
      <!-- Avatar section -->
      <div class="flex shrink-0 flex-col items-center gap-2">
        <button
          class="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-muted transition-colors hover:bg-accent"
          @click="triggerAvatarUpload"
        >
          <img
            v-if="resolvedAvatar"
            :src="resolvedAvatar"
            alt="Server avatar"
            class="h-full w-full object-cover"
          >
          <span
            v-else
            class="text-2xl font-bold text-muted-foreground"
          >
            {{ serverName.charAt(0).toUpperCase() }}
          </span>
          <!-- Overlay on hover -->
          <div class="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera :size="20" class="text-white" />
            <span class="mt-1 text-[10px] font-bold uppercase text-white">Change</span>
          </div>
        </button>
        <span class="text-[11px] text-muted-foreground">
          {{ isUploadingAvatar ? 'Uploading...' : 'Min 128x128' }}
        </span>
        <input
          ref="avatarInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleAvatarChange"
        >
      </div>

      <!-- Form fields -->
      <div class="flex-1 space-y-5">
        <!-- Server Name -->
        <div class="space-y-2">
          <Label class="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Server Name
          </Label>
          <Input
            v-model="name"
            placeholder="Server name"
          />
        </div>

        <!-- Description / Topic -->
        <div class="space-y-2">
          <Label class="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Server Description
          </Label>
          <Textarea
            v-model="topic"
            rows="4"
            placeholder="Tell people about your server"
            class="flex w-full rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>
      </div>
    </div>

    <!-- Save error -->
    <p v-if="saveError" class="mt-4 text-sm text-destructive">
      {{ saveError }}
    </p>

    <!-- Save bar (only when dirty) -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="translate-y-2 opacity-0"
      leave-to-class="translate-y-2 opacity-0"
    >
      <div
        v-if="isDirty"
        class="mt-6 flex items-center justify-between rounded-md bg-popover p-3"
      >
        <span class="text-sm text-muted-foreground">
          Careful — you have unsaved changes!
        </span>
        <div class="flex gap-2">
          <Button variant="ghost" size="sm" @click="resetChanges">
            Reset
          </Button>
          <Button size="sm" :disabled="isSaving || !name.trim()" @click="saveChanges">
            {{ isSaving ? 'Saving...' : 'Save Changes' }}
          </Button>
        </div>
      </div>
    </Transition>
  </div>
</template>

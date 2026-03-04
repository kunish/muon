<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useServerStore } from '@/features/server/stores/serverStore'
import { createSpace } from '@/matrix/spaces'
import Button from '@/shared/components/ui/button.vue'
import Dialog from '@/shared/components/ui/dialog.vue'
import Input from '@/shared/components/ui/input.vue'

const router = useRouter()
const serverStore = useServerStore()

const open = ref(false)
const serverName = ref('')
const isCreating = ref(false)

async function handleCreate() {
  if (!serverName.value.trim() || isCreating.value)
    return
  isCreating.value = true
  try {
    const spaceId = await createSpace(serverName.value.trim())
    serverStore.loadServers()
    serverStore.selectServer(spaceId)
    open.value = false
    serverName.value = ''
    // Navigate to the new server (no channels yet)
    router.push(`/server/${encodeURIComponent(spaceId)}/channel/`)
  }
  catch (error) {
    console.error('Failed to create server:', error)
  }
  finally {
    isCreating.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <template #trigger>
      <slot name="trigger" />
    </template>

    <div class="space-y-4">
      <div>
        <h2 class="text-xl font-bold text-foreground">
          Create a Server
        </h2>
        <p class="text-sm text-muted-foreground mt-1">
          Your server is where you and your friends hang out. Make yours and start talking.
        </p>
      </div>

      <div class="space-y-2">
        <label class="text-xs font-bold text-muted-foreground uppercase tracking-wide">
          Server Name
        </label>
        <Input
          v-model="serverName"
          placeholder="Enter server name"
          @keydown.enter="handleCreate"
        />
      </div>

      <div class="flex justify-end gap-2">
        <Button variant="ghost" @click="open = false">
          Cancel
        </Button>
        <Button :disabled="!serverName.trim() || isCreating" @click="handleCreate">
          {{ isCreating ? 'Creating...' : 'Create' }}
        </Button>
      </div>
    </div>
  </Dialog>
</template>

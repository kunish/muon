<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useServerStore } from '@/features/server/stores/serverStore'
import { createSpace } from '@/matrix/spaces'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'

const router = useRouter()
const serverStore = useServerStore()
const { t } = useI18n()

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
    toast.error(t('auth.error'))
  }
  finally {
    isCreating.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <span class="contents" @click="open = true">
      <slot name="trigger" />
    </span>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create a Server</DialogTitle>
        <DialogDescription>Your server is where you and your friends hang out. Make yours and start talking.</DialogDescription>
      </DialogHeader>
      <div class="space-y-2">
        <Label class="text-xs font-bold text-muted-foreground uppercase tracking-wide">
          Server Name
        </Label>
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
    </DialogContent>
  </Dialog>
</template>

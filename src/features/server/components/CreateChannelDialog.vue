<script setup lang="ts">
import { Hash, Lock, Volume2 } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useServerStore } from '@/features/server/stores/serverStore'
import { createChannel } from '@/matrix/spaces'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'

const props = withDefaults(defineProps<{
  /** Pre-fill category when creating from a category header */
  categoryId?: string
}>(), {
  categoryId: undefined,
})

const open = defineModel<boolean>('open', { default: false })

const router = useRouter()
const serverStore = useServerStore()
const { t } = useI18n()

const channelName = ref('')
const channelType = ref<'text' | 'voice'>('text')
const isPrivate = ref(false)
const isCreating = ref(false)

// Reset form when dialog opens
watch(open, (val) => {
  if (val) {
    channelName.value = ''
    channelType.value = 'text'
    isPrivate.value = false
    isCreating.value = false
  }
})

async function handleCreate() {
  const serverId = serverStore.currentServerId
  if (!serverId || !channelName.value.trim() || isCreating.value)
    return

  isCreating.value = true
  try {
    const roomId = await createChannel(serverId, channelName.value.trim(), {
      isVoice: channelType.value === 'voice',
      isPrivate: isPrivate.value,
      categoryId: props.categoryId || undefined,
    })

    // Refresh channel tree
    serverStore.loadChannelTree(serverId)

    // Navigate to the new channel (text only)
    if (channelType.value === 'text') {
      serverStore.selectChannel(roomId)
      router.push(`/server/${encodeURIComponent(serverId)}/channel/${encodeURIComponent(roomId)}`)
    }

    open.value = false
  }
  catch (error) {
    console.error('Failed to create channel:', error)
  }
  finally {
    isCreating.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <slot name="trigger" />
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t('channel.create_channel') }}</DialogTitle>
        <DialogDescription>{{ categoryId ? t('channel.in_this_category') : t('channel.in_your_server') }}</DialogDescription>
      </DialogHeader>

      <!-- Channel Type -->
      <div class="space-y-2">
        <Label class="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {{ t('channel.channel_type') }}
        </Label>
        <div class="space-y-1">
          <button
            class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 transition-colors"
            :class="channelType === 'text' ? 'bg-accent/50' : 'hover:bg-accent/20'"
            @click="channelType = 'text'"
          >
            <div class="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <Hash :size="18" class="text-muted-foreground" />
            </div>
            <div class="text-left">
              <div class="text-sm font-medium text-foreground">
                {{ t('channel.text_channel') }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ t('channel.text_channel_desc') }}
              </div>
            </div>
            <div
              class="ml-auto h-5 w-5 shrink-0 rounded-full border-2 transition-colors"
              :class="channelType === 'text' ? 'border-primary bg-primary' : 'border-muted-foreground'"
            >
              <div v-if="channelType === 'text'" class="m-0.5 h-2.5 w-2.5 rounded-full bg-primary-foreground" />
            </div>
          </button>

          <button
            class="flex w-full items-center gap-3 rounded-md px-3 py-2.5 transition-colors"
            :class="channelType === 'voice' ? 'bg-accent/50' : 'hover:bg-accent/20'"
            @click="channelType = 'voice'"
          >
            <div class="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <Volume2 :size="18" class="text-muted-foreground" />
            </div>
            <div class="text-left">
              <div class="text-sm font-medium text-foreground">
                {{ t('channel.voice_channel') }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ t('channel.voice_channel_desc') }}
              </div>
            </div>
            <div
              class="ml-auto h-5 w-5 shrink-0 rounded-full border-2 transition-colors"
              :class="channelType === 'voice' ? 'border-primary bg-primary' : 'border-muted-foreground'"
            >
              <div v-if="channelType === 'voice'" class="m-0.5 h-2.5 w-2.5 rounded-full bg-primary-foreground" />
            </div>
          </button>
        </div>
      </div>

      <!-- Channel Name -->
      <div class="space-y-2">
        <Label class="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {{ t('channel.channel_name') }}
        </Label>
        <div class="relative">
          <div class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Hash v-if="channelType === 'text'" :size="16" />
            <Volume2 v-else :size="16" />
          </div>
          <Input
            v-model="channelName"
            :placeholder="t('channel.channel_name_placeholder')"
            class="pl-9"
            @keydown.enter="handleCreate"
          />
        </div>
      </div>

      <!-- Private Toggle -->
      <div
        class="flex w-full items-center gap-3 rounded-md"
      >
        <Lock :size="16" class="text-muted-foreground" />
        <div class="text-left">
          <div class="text-sm font-medium text-foreground">
            {{ t('channel.private_channel') }}
          </div>
          <div class="text-xs text-muted-foreground">
            {{ t('channel.private_channel_desc') }}
          </div>
        </div>
        <div class="ml-auto">
          <Switch :checked="isPrivate" @update:checked="val => isPrivate = val" />
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-2">
        <Button variant="ghost" @click="open = false">
          {{ t('common.cancel') }}
        </Button>
        <Button :disabled="!channelName.trim() || isCreating" @click="handleCreate">
          {{ isCreating ? t('chat.creating') : t('channel.create_channel') }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

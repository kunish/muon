<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useServerStore } from '@/features/server/stores/serverStore'
import { createSpace } from '@/matrix/spaces'
import Button from '@/shared/components/ui/button.vue'
import Dialog from '@/shared/components/ui/dialog.vue'
import Input from '@/shared/components/ui/input.vue'

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const serverStore = useServerStore()

const categoryName = ref('')
const isCreating = ref(false)

watch(open, (val) => {
  if (val) {
    categoryName.value = ''
    isCreating.value = false
  }
})

async function handleCreate() {
  const serverId = serverStore.currentServerId
  const name = categoryName.value.trim()
  if (!serverId || !name || isCreating.value)
    return

  isCreating.value = true
  try {
    await createSpace(name, {
      parentSpaceId: serverId,
      isPublic: false,
    })
    serverStore.loadChannelTree(serverId)
    open.value = false
  }
  catch (error) {
    console.error('Failed to create category:', error)
  }
  finally {
    isCreating.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <div class="space-y-4">
      <div>
        <h2 class="text-xl font-bold text-foreground">
          {{ t('channel.create_category') }}
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ t('channel.in_your_server') }}
        </p>
      </div>

      <div class="space-y-2">
        <label class="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {{ t('channel.category_name') }}
        </label>
        <Input
          v-model="categoryName"
          :placeholder="t('channel.category_name_placeholder')"
          @keydown.enter="handleCreate"
        />
      </div>

      <div class="flex justify-end gap-2">
        <Button variant="ghost" @click="open = false">
          {{ t('common.cancel') }}
        </Button>
        <Button :disabled="!categoryName.trim() || isCreating" @click="handleCreate">
          {{ isCreating ? t('chat.creating') : t('channel.create_category') }}
        </Button>
      </div>
    </div>
  </Dialog>
</template>

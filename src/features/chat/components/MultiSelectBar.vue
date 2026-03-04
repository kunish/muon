<script setup lang="ts">
import { redactMessage } from '@matrix/index'
import { ask } from '@tauri-apps/plugin-dialog'
import { Forward, Trash2, X } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChatStore } from '../stores/chatStore'

const emit = defineEmits<{
  forward: []
}>()

const { t } = useI18n()

const store = useChatStore()

const selectedCount = computed(() => store.selectedMessages.size)

async function onBatchDelete() {
  const confirmed = await ask(t('chat.confirm_batch_redact', { count: selectedCount.value }), {
    title: t('chat.batch_redact'),
    kind: 'warning',
  })
  if (!confirmed)
    return

  const roomId = store.currentRoomId
  if (!roomId)
    return

  for (const eventId of store.selectedMessages) {
    try {
      await redactMessage(roomId, eventId)
    }
    catch (err) {
      console.error('撤回失败:', eventId, err)
    }
  }
  store.exitMultiSelect()
}

function onForward() {
  emit('forward')
}

function onCancel() {
  store.exitMultiSelect()
}
</script>

<template>
  <div class="bg-background/95 backdrop-blur-xl border-t border-border px-4 py-3 flex items-center justify-between gap-3">
    <span class="text-sm text-muted-foreground">
      {{ t('chat.selected_count', { count: selectedCount }) }}
    </span>
    <div class="flex items-center gap-1.5">
      <button
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg hover:bg-accent transition-colors cursor-pointer"
        :disabled="selectedCount === 0"
        @click="onForward"
      >
        <Forward :size="14" />
        {{ t('chat.forward') }}
      </button>
      <button
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
        :disabled="selectedCount === 0"
        @click="onBatchDelete"
      >
        <Trash2 :size="14" />
        {{ t('chat.delete') }}
      </button>
      <button
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg hover:bg-accent transition-colors cursor-pointer"
        @click="onCancel"
      >
        <X :size="14" />
        {{ t('chat.cancel') }}
      </button>
    </div>
  </div>
</template>

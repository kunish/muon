<script setup lang="ts">
import { Copy, FileJson, MessageSquare, Reply, Trash2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

defineProps<{
  isMine: boolean
  showDebug?: boolean
}>()

const emit = defineEmits<{
  reply: []
  copy: []
  openThread: []
  delete: []
  viewRawJson: []
  copyRawJson: []
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="min-w-[176px] rounded-[10px] border border-border/60 bg-popover/95 py-1.5 shadow-[var(--shadow-s3-down)] backdrop-blur-xl"
    @contextmenu.prevent
  >
    <button
      class="mx-1 flex w-[calc(100%-8px)] h-8 items-center gap-2.5 rounded-md px-3 py-1.5 text-base text-foreground transition-all duration-[120ms] hover:bg-accent"
      @click="emit('reply')"
    >
      <Reply :size="14" />
      <span>{{ t('chat.action_reply') }}</span>
    </button>
    <button
      class="mx-1 flex w-[calc(100%-8px)] h-8 items-center gap-2.5 rounded-md px-3 py-1.5 text-base text-foreground transition-all duration-[120ms] hover:bg-accent"
      @click="emit('copy')"
    >
      <Copy :size="14" />
      <span>{{ t('chat.action_copy') }}</span>
    </button>
    <button
      class="mx-1 flex w-[calc(100%-8px)] h-8 items-center gap-2.5 rounded-md px-3 py-1.5 text-base text-foreground transition-all duration-[120ms] hover:bg-accent"
      @click="emit('openThread')"
    >
      <MessageSquare :size="14" />
      <span>{{ t('chat.thread') }}</span>
    </button>
    <button
      v-if="isMine"
      class="mx-1 flex w-[calc(100%-8px)] h-8 items-center gap-2.5 rounded-md px-3 py-1.5 text-base text-destructive transition-all duration-[120ms] hover:bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)]"
      @click="emit('delete')"
    >
      <Trash2 :size="14" />
      <span>{{ t('chat.delete_message') }}</span>
    </button>

    <template v-if="showDebug">
      <div class="h-px bg-border/40 my-1 mx-2" />
      <button
        class="mx-1 flex w-[calc(100%-8px)] h-8 items-center gap-2.5 rounded-md px-3 py-1.5 text-base text-foreground transition-all duration-[120ms] hover:bg-accent"
        @click="emit('viewRawJson')"
      >
        <FileJson :size="14" />
        <span>{{ t('chat.view_raw_json') }}</span>
      </button>
      <button
        class="mx-1 flex w-[calc(100%-8px)] h-8 items-center gap-2.5 rounded-md px-3 py-1.5 text-base text-foreground transition-all duration-[120ms] hover:bg-accent"
        @click="emit('copyRawJson')"
      >
        <Copy :size="14" />
        <span>{{ t('chat.copy_raw_json') }}</span>
      </button>
    </template>
  </div>
</template>

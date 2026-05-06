<script setup lang="ts">
import { Copy, MessageSquare, Reply, Trash2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

defineProps<{
  isMine: boolean
}>()

const emit = defineEmits<{
  reply: []
  copy: []
  openThread: []
  delete: []
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="min-w-[180px] rounded-xl border border-border/60 bg-popover/95 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] backdrop-blur-xl"
    @contextmenu.prevent
  >
    <button
      class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-foreground transition-all duration-[120ms] hover:bg-accent"
      @click="emit('reply')"
    >
      <Reply :size="14" />
      <span>{{ t('chat.action_reply') }}</span>
    </button>
    <button
      class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-foreground transition-all duration-[120ms] hover:bg-accent"
      @click="emit('copy')"
    >
      <Copy :size="14" />
      <span>{{ t('chat.action_copy') }}</span>
    </button>
    <button
      class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-foreground transition-all duration-[120ms] hover:bg-accent"
      @click="emit('openThread')"
    >
      <MessageSquare :size="14" />
      <span>{{ t('chat.thread') }}</span>
    </button>
    <button
      v-if="isMine"
      class="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3.5 py-[7px] text-[13px] text-destructive transition-all duration-[120ms] hover:bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)]"
      @click="emit('delete')"
    >
      <Trash2 :size="14" />
      <span>{{ t('chat.delete_message') }}</span>
    </button>
  </div>
</template>

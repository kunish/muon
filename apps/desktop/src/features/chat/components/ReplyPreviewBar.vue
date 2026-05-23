<script setup lang="ts">
import { X } from 'lucide-vue-next';

defineProps<{
  /** Reply-to sender display name */
  replyingToSenderName: string;
  /** Reply preview text */
  replyingToPreview: string;
  /** Edit mode label */
  composeLabel: string;
  /** Whether reply bar is showing (store.replyingTo is truthy) */
  isReplying: boolean;
}>();

const emit = defineEmits<{
  clear: [];
  jumpToReplyTarget: [];
}>();
</script>

<template>
  <div v-if="isReplying || composeLabel" class="pt-2">
    <!-- Reply indicator -->
    <div
      v-if="isReplying"
      class="flex items-start justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2"
    >
      <button class="min-w-0 text-left" @click="emit('jumpToReplyTarget')">
        <div class="text-xs font-medium text-primary">
          {{ $t('chat.reply_label', { sender: replyingToSenderName }) }}
        </div>
        <div class="truncate text-xs text-muted-foreground">
          {{ replyingToPreview }}
        </div>
      </button>
      <button class="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent" @click="emit('clear')">
        <X :size="14" />
      </button>
    </div>

    <!-- Edit indicator -->
    <div v-else-if="composeLabel" class="flex items-center justify-between text-xs text-muted-foreground">
      <span>{{ composeLabel }}</span>
      <button class="p-0.5 rounded hover:bg-accent" @click="emit('clear')">
        <X :size="14" />
      </button>
    </div>
  </div>
</template>

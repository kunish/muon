<script setup lang="ts">
import {
  CheckSquare,
  Copy,
  EyeOff,
  FileJson,
  Forward,
  Languages,
  MessageSquare,
  Pin,
  PinOff,
  Reply,
  Star,
  StarOff,
  Trash2,
} from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';

defineProps<{
  isMine: boolean;
  showDebug?: boolean;
  isPinned?: boolean;
  isStarred?: boolean;
  canTranslate?: boolean;
  isTranslated?: boolean;
}>();

const emit = defineEmits<{
  reply: [];
  forward: [];
  copy: [];
  togglePin: [];
  toggleStar: [];
  translate: [];
  openThread: [];
  multiSelect: [];
  hideForMe: [];
  recall: [];
  viewRawJson: [];
  copyRawJson: [];
}>();

const { t } = useI18n();
</script>

<template>
  <div
    class="min-w-[176px] rounded-[10px] border border-border/60 bg-popover/95 py-1.5 shadow-[var(--shadow-s3-down)] backdrop-blur-xl"
    @contextmenu.prevent
  >
    <button
      class="mx-1 flex h-8 w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3 py-1.5 text-base text-foreground transition-all duration-[120ms] hover:bg-accent"
      @click="emit('reply')"
    >
      <Reply :size="14" />
      <span>{{ t('chat.action_reply') }}</span>
    </button>
    <button
      class="mx-1 flex h-8 w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3 py-1.5 text-base text-foreground transition-all duration-[120ms] hover:bg-accent"
      data-testid="context-forward"
      @click="emit('forward')"
    >
      <Forward :size="14" />
      <span>{{ t('chat.action_forward') }}</span>
    </button>
    <button
      class="mx-1 flex h-8 w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3 py-1.5 text-base text-foreground transition-all duration-[120ms] hover:bg-accent"
      @click="emit('copy')"
    >
      <Copy :size="14" />
      <span>{{ t('chat.action_copy') }}</span>
    </button>
    <button
      class="mx-1 flex h-8 w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3 py-1.5 text-base text-foreground transition-all duration-[120ms] hover:bg-accent"
      data-testid="context-pin"
      @click="emit('togglePin')"
    >
      <component :is="isPinned ? PinOff : Pin" :size="14" />
      <span>{{ isPinned ? t('chat.unpin_message') : t('chat.pin_message') }}</span>
    </button>
    <button
      class="mx-1 flex h-8 w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3 py-1.5 text-base text-foreground transition-all duration-[120ms] hover:bg-accent"
      data-testid="context-star"
      @click="emit('toggleStar')"
    >
      <component :is="isStarred ? StarOff : Star" :size="14" />
      <span>{{ isStarred ? t('chat.unstar_message') : t('chat.star_message') }}</span>
    </button>
    <button
      v-if="canTranslate"
      class="mx-1 flex h-8 w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3 py-1.5 text-base text-foreground transition-all duration-[120ms] hover:bg-accent"
      data-testid="context-translate"
      @click="emit('translate')"
    >
      <Languages :size="14" />
      <span>{{ isTranslated ? t('chat.hide_translation') : t('chat.translate') }}</span>
    </button>
    <button
      class="mx-1 flex h-8 w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3 py-1.5 text-base text-foreground transition-all duration-[120ms] hover:bg-accent"
      @click="emit('openThread')"
    >
      <MessageSquare :size="14" />
      <span>{{ t('chat.thread') }}</span>
    </button>
    <button
      class="mx-1 flex h-8 w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3 py-1.5 text-base text-foreground transition-all duration-[120ms] hover:bg-accent"
      data-testid="context-multiselect"
      @click="emit('multiSelect')"
    >
      <CheckSquare :size="14" />
      <span>{{ t('chat.multi_select') }}</span>
    </button>
    <button
      class="mx-1 flex h-8 w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3 py-1.5 text-base text-foreground transition-all duration-[120ms] hover:bg-accent"
      data-testid="context-hide"
      @click="emit('hideForMe')"
    >
      <EyeOff :size="14" />
      <span>{{ t('chat.hide_for_me') }}</span>
    </button>
    <template v-if="isMine">
      <div class="mx-2 my-1 h-px bg-border/40" />
      <button
        class="mx-1 flex h-8 w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3 py-1.5 text-base text-destructive transition-all duration-[120ms] hover:bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)]"
        data-testid="context-recall"
        @click="emit('recall')"
      >
        <Trash2 :size="14" />
        <span>{{ t('chat.recall') }}</span>
      </button>
    </template>

    <template v-if="showDebug">
      <div class="mx-2 my-1 h-px bg-border/40" />
      <button
        class="mx-1 flex h-8 w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3 py-1.5 text-base text-foreground transition-all duration-[120ms] hover:bg-accent"
        @click="emit('viewRawJson')"
      >
        <FileJson :size="14" />
        <span>{{ t('chat.view_raw_json') }}</span>
      </button>
      <button
        class="mx-1 flex h-8 w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-3 py-1.5 text-base text-foreground transition-all duration-[120ms] hover:bg-accent"
        @click="emit('copyRawJson')"
      >
        <Copy :size="14" />
        <span>{{ t('chat.copy_raw_json') }}</span>
      </button>
    </template>
  </div>
</template>

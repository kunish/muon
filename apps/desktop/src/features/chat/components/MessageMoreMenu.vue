<script setup lang="ts">
import {
  CheckSquare,
  Edit,
  EyeOff,
  Languages,
  Pin,
  PinOff,
  Star,
  StarOff,
  Trash2,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

defineProps<{
  isMine: boolean
  isPinned: boolean
  isStarred: boolean
  isTextMessage: boolean
  translatedText: string | null
}>()

const emit = defineEmits<{
  close: []
  edit: []
  redact: []
  togglePin: []
  toggleStar: []
  translate: []
  hideForMe: []
  multiSelect: []
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="absolute top-full right-0 mt-1 bg-popover/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] py-1 z-20 min-w-[140px]"
  >
    <!-- Group 1: Edit / Delete (own messages) -->
    <template v-if="isMine">
      <button
        class="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-[7px] text-xs transition-colors duration-100 hover:bg-accent"
        @click.stop="emit('edit'); emit('close')"
      >
        <Edit :size="13" /> {{ t("chat.edit_message") }}
      </button>
      <button
        class="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-[7px] text-xs text-destructive transition-colors duration-100 hover:bg-accent"
        @click.stop="emit('redact'); emit('close')"
      >
        <Trash2 :size="13" /> {{ t("chat.recall") }}
      </button>
      <div class="h-px bg-border/40 my-1 mx-2" />
    </template>

    <!-- Group 2: Pin / Star -->
    <button
      class="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-[7px] text-xs transition-colors duration-100 hover:bg-accent"
      @click.stop="emit('togglePin')"
    >
      <component :is="isPinned ? PinOff : Pin" :size="13" />
      {{ isPinned ? t("chat.unpin_message") : t("chat.pin_message") }}
    </button>
    <button
      class="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-[7px] text-xs transition-colors duration-100 hover:bg-accent"
      @click.stop="emit('toggleStar')"
    >
      <component :is="isStarred ? StarOff : Star" :size="13" />
      {{ isStarred ? t("chat.unstar_message") : t("chat.star_message") }}
    </button>

    <!-- Group 3: Translate (text only) -->
    <template v-if="isTextMessage">
      <div class="h-px bg-border/40 my-1 mx-2" />
      <button
        class="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-[7px] text-xs transition-colors duration-100 hover:bg-accent"
        @click.stop="emit('translate')"
      >
        <Languages :size="13" />
        {{ translatedText ? t("chat.hide_translation") : t("chat.translate") }}
      </button>
    </template>

    <!-- Group 4: Hide / Multi-select -->
    <div class="h-px bg-border/40 my-1 mx-2" />
    <button
      class="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-[7px] text-xs text-muted-foreground transition-colors duration-100 hover:bg-accent"
      @click.stop="emit('hideForMe')"
    >
      <EyeOff :size="13" /> {{ t("chat.hide_for_me") }}
    </button>
    <button
      class="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-[7px] text-xs transition-colors duration-100 hover:bg-accent"
      @click.stop="emit('multiSelect')"
    >
      <CheckSquare :size="13" /> {{ t("chat.multi_select") }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { SmilePlus } from 'lucide-vue-next'

defineProps<{
  showEmojiPicker: boolean
}>()

const emit = defineEmits<{
  toggle: []
  react: [emoji: string]
}>()

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉']
const EMOJI_GRID = [
  '👍',
  '👏',
  '🙏',
  '🤝',
  '💪',
  '🫡',
  '👋',
  '✌️',
  '😀',
  '😊',
  '😄',
  '😁',
  '😆',
  '🥰',
  '😂',
  '🥲',
  '😎',
  '🤩',
  '😏',
  '🤔',
  '🙄',
  '😮',
  '😢',
  '😡',
  '❤️',
  '🔥',
  '🎉',
  '✅',
  '💯',
  '⭐',
  '🙌',
  '🤗',
  '👀',
  '💡',
  '📌',
  '🚀',
  '🎯',
  '💬',
  '👌',
  '🆗',
]
</script>

<template>
  <div class="relative">
    <button
      class="cursor-pointer rounded-lg p-[5px] text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground"
      :title="$t('chat.action_emoji')"
      @click.stop="emit('toggle')"
    >
      <SmilePlus :size="14" />
    </button>
    <Transition
      enter-active-class="transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
      leave-active-class="transition-all duration-100 ease-in"
      enter-from-class="opacity-0 -translate-y-1 scale-95"
      leave-to-class="opacity-0 -translate-y-1 scale-95"
    >
      <div
        v-if="showEmojiPicker"
        class="absolute bottom-full right-0 mb-1 bg-popover/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] z-20 w-[280px]"
        @click.stop
      >
        <!-- Quick reactions row -->
        <div class="flex gap-1 p-2 border-b border-border/30">
          <button
            v-for="emoji in QUICK_EMOJIS"
            :key="emoji"
            class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent text-base transition-transform hover:scale-125 cursor-pointer"
            @click.stop="emit('react', emoji)"
          >
            {{ emoji }}
          </button>
        </div>
        <!-- Full emoji grid -->
        <div class="max-h-[200px] overflow-y-auto p-2">
          <div class="grid grid-cols-8 gap-0.5">
            <button
              v-for="emoji in EMOJI_GRID"
              :key="emoji"
              class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-accent text-base transition-transform hover:scale-110 cursor-pointer"
              @click.stop="emit('react', emoji)"
            >
              {{ emoji }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { ImageSticker } from '@/shared/data/stickerPacks'
import type { GifResult } from '@/shared/lib/gifSearch'
import { Smile, Sticker } from 'lucide-vue-next'
import { reactive, ref, watch } from 'vue'
import EmojiPicker from './EmojiPicker.vue'
import GifPicker from './GifPicker.vue'
import StickerPicker from './StickerPicker.vue'

export type ExpressionTab = 'emoji' | 'gif' | 'sticker'

const props = withDefaults(defineProps<{
  initialTab?: ExpressionTab
}>(), {
  initialTab: 'emoji',
})

const emit = defineEmits<{
  selectEmoji: [emoji: string]
  selectGif: [gif: GifResult]
  selectSticker: [emoji: string, name: string]
  selectImageSticker: [sticker: ImageSticker]
  manageSticker: []
  tabChange: [tab: ExpressionTab]
}>()

const activeTab = ref<ExpressionTab>(props.initialTab)

// 避免切换卡顿：面板首次打开时惰性挂载，之后仅 v-show 切换，不重复卸载/重建。
const mountedTabs = reactive<Record<ExpressionTab, boolean>>({
  emoji: true,
  gif: false,
  sticker: false,
})
mountedTabs[props.initialTab] = true

watch(() => props.initialTab, (tab) => {
  activeTab.value = tab
})

watch(activeTab, (tab) => {
  mountedTabs[tab] = true
  emit('tabChange', tab)
})

const tabs: { id: ExpressionTab, label: string }[] = [
  { id: 'emoji', label: 'Emoji' },
  { id: 'gif', label: 'GIF' },
  { id: 'sticker', label: 'Sticker' },
]

function onStickerSelect(emoji: string, name: string) {
  emit('selectSticker', emoji, name)
}
</script>

<template>
  <div class="flex h-[min(460px,calc(100vh-24px))] min-h-0 w-[min(360px,calc(100vw-16px))] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
    <div class="flex items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground"
        :class="activeTab === tab.id && 'bg-accent text-foreground'"
        :title="tab.label"
        @click="activeTab = tab.id"
      >
        <Smile v-if="tab.id === 'emoji'" :size="15" />
        <span v-else-if="tab.id === 'gif'" class="text-[11px] font-bold leading-none">GIF</span>
        <Sticker v-else :size="15" />
        <span class="hidden sm:inline">{{ tab.label }}</span>
      </button>
    </div>

    <div class="min-h-0 flex-1 [&_.emoji-picker]:size-full [&_.emoji-picker]:rounded-none [&_.emoji-picker]:border-0 [&_.emoji-picker]:bg-transparent [&_.emoji-picker]:shadow-none [&_.gif-picker]:size-full [&_.gif-picker]:rounded-none [&_.gif-picker]:border-0 [&_.gif-picker]:bg-transparent [&_.gif-picker]:shadow-none [&_.sticker-picker]:size-full [&_.sticker-picker]:rounded-none [&_.sticker-picker]:border-0 [&_.sticker-picker]:bg-transparent [&_.sticker-picker]:shadow-none">
      <EmojiPicker
        v-if="mountedTabs.emoji"
        v-show="activeTab === 'emoji'"
        @select="emit('selectEmoji', $event)"
      />

      <GifPicker
        v-if="mountedTabs.gif"
        v-show="activeTab === 'gif'"
        @select="emit('selectGif', $event)"
      />

      <StickerPicker
        v-if="mountedTabs.sticker"
        v-show="activeTab === 'sticker'"
        @select="onStickerSelect"
        @select-image="emit('selectImageSticker', $event)"
        @manage="emit('manageSticker')"
      />
    </div>
  </div>
</template>

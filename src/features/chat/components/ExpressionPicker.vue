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
  <div class="expression-picker flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
    <div class="flex items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="expr-tab"
        :class="activeTab === tab.id && 'expr-tab-active'"
        :title="tab.label"
        @click="activeTab = tab.id"
      >
        <Smile v-if="tab.id === 'emoji'" :size="15" />
        <span v-else-if="tab.id === 'gif'" class="text-[11px] font-bold leading-none">GIF</span>
        <Sticker v-else :size="15" />
        <span class="hidden sm:inline">{{ tab.label }}</span>
      </button>
    </div>

    <div class="expression-content min-h-0 flex-1">
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

<style scoped>
.expression-picker {
  width: min(360px, calc(100vw - 16px));
  height: min(460px, calc(100vh - 24px));
}

.expr-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 6px;
  padding: 6px 8px;
  color: var(--color-muted-foreground);
  cursor: pointer;
  transition: all 0.12s ease;
}

.expr-tab:hover {
  background: var(--color-accent);
  color: var(--color-foreground);
}

.expr-tab-active {
  background: var(--color-accent);
  color: var(--color-foreground);
}

.expression-content :deep(.emoji-picker),
.expression-content :deep(.gif-picker),
.expression-content :deep(.sticker-picker) {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}
</style>

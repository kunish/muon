<script setup lang="ts">
import type { RecentSticker } from '../stores/stickerStore'
import type { ImageSticker } from '@/shared/data/stickerPacks'
import { Settings } from 'lucide-vue-next'
import { computed, defineComponent, h, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthMedia } from '@/shared/composables/useAuthMedia'
import { BUILTIN_STICKER_PACKS } from '@/shared/data/stickerPacks'
import { useStickerStore } from '../stores/stickerStore'

const emit = defineEmits<{
  select: [emoji: string, name: string]
  selectImage: [sticker: ImageSticker]
  manage: []
}>()

const { t } = useI18n()

const stickerStore = useStickerStore()

const activeTabId = ref<string>(
  stickerStore.recentStickers.length > 0 ? 'recent' : BUILTIN_STICKER_PACKS[0].id,
)

// 所有 tab：最近 → 内置 → 自定义
const tabs = computed(() => {
  const list: { id: string, icon: string, label: string, type: 'recent' | 'builtin' | 'custom' }[] = []
  if (stickerStore.recentStickers.length > 0) {
    list.push({ id: 'recent', icon: '🕐', label: t('chat.sticker_recent'), type: 'recent' })
  }
  for (const p of BUILTIN_STICKER_PACKS) {
    list.push({ id: p.id, icon: p.icon, label: p.label, type: 'builtin' })
  }
  for (const p of stickerStore.customPacks) {
    list.push({ id: p.id, icon: p.icon ? '📦' : '📦', label: p.name, type: 'custom' })
  }
  return list
})

const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value) || tabs.value[0])

const activeBuiltinPack = computed(() =>
  BUILTIN_STICKER_PACKS.find(p => p.id === activeTabId.value),
)

const activeCustomPack = computed(() =>
  stickerStore.customPacks.find(p => p.id === activeTabId.value),
)

function onEmojiSelect(emoji: string, name: string) {
  stickerStore.addRecentEmoji(emoji, name)
  emit('select', emoji, name)
}

function onImageSelect(sticker: ImageSticker) {
  stickerStore.addRecentImage(sticker, activeTabId.value)
  emit('selectImage', sticker)
}

function onRecentSelect(recent: RecentSticker) {
  if (recent.type === 'emoji') {
    stickerStore.addRecentEmoji(recent.value, recent.name)
    emit('select', recent.value, recent.name)
  }
  else if (recent.mxcUrl) {
    const sticker: ImageSticker = {
      id: recent.mxcUrl,
      name: recent.name,
      mxcUrl: recent.mxcUrl,
      width: recent.width || 128,
      height: recent.height || 128,
      mimetype: recent.mimetype || 'image/webp',
    }
    stickerStore.addRecentImage(sticker, recent.packId)
    emit('selectImage', sticker)
  }
}

/** 图片贴纸缩略图子组件 */
const StickerThumb = defineComponent({
  name: 'StickerThumb',
  props: {
    mxcUrl: { type: String, required: true },
    size: { type: Number, default: 96 },
    imgClass: { type: String, default: 'w-full h-full rounded-lg object-cover' },
  },
  setup(props) {
    const src = useAuthMedia(toRef(props, 'mxcUrl'), props.size, props.size)
    return () =>
      src.value
        ? h('img', { src: src.value, class: props.imgClass })
        : h('div', { class: `${props.imgClass} bg-muted/40 animate-pulse` })
  },
})
</script>

<template>
  <div class="flex h-[min(380px,calc(100vh-24px))] w-[min(340px,calc(100vw-16px))] flex-col overflow-hidden rounded-xl border border-border bg-popover/95 shadow-2xl backdrop-blur-xl">
    <!-- Tab 栏 -->
    <div class="flex items-center gap-0.5 overflow-x-auto border-b border-border bg-muted/30 px-1 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="flex h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[1.15rem] opacity-50 transition-[background,opacity] duration-150 hover:bg-accent hover:opacity-80"
        :class="{ 'bg-accent opacity-100': activeTabId === tab.id }"
        :title="tab.label"
        @click="activeTabId = tab.id"
      >
        {{ tab.icon }}
      </button>
      <!-- 管理按钮 -->
      <button
        class="ml-auto flex h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[1.15rem] opacity-50 transition-[background,opacity] duration-150 hover:bg-accent hover:opacity-80"
        :title="t('chat.sticker_manage')"
        @click="emit('manage')"
      >
        <Settings :size="14" />
      </button>
    </div>

    <!-- 内容区 -->
    <div class="flex-1 overflow-y-auto px-3 py-2">
      <div class="text-[11px] text-muted-foreground/70 font-medium mb-1.5">
        {{ activeTab?.label || '' }}
      </div>

      <!-- 最近使用 -->
      <template v-if="activeTabId === 'recent'">
        <div class="grid grid-cols-5 gap-1">
          <button
            v-for="(recent, idx) in stickerStore.recentStickers"
            :key="idx"
            class="flex size-12 cursor-pointer items-center justify-center rounded-[10px] text-[2rem] transition-[background,transform] duration-150 hover:bg-accent hover:scale-[1.15] active:scale-[0.92]"
            :title="recent.name"
            @click="onRecentSelect(recent)"
          >
            <template v-if="recent.type === 'emoji'">
              {{ recent.value }}
            </template>
            <template v-else-if="recent.mxcUrl">
              <StickerThumb :mxc-url="recent.mxcUrl" img-class="w-10 h-10 rounded-lg object-cover" />
            </template>
          </button>
        </div>
      </template>

      <!-- 内置 emoji 包 -->
      <template v-else-if="activeBuiltinPack">
        <div class="grid grid-cols-5 gap-1">
          <button
            v-for="sticker in activeBuiltinPack.stickers"
            :key="sticker.emoji"
            class="flex size-12 cursor-pointer items-center justify-center rounded-[10px] text-[2rem] transition-[background,transform] duration-150 hover:bg-accent hover:scale-[1.15] active:scale-[0.92]"
            :title="sticker.name"
            @click="onEmojiSelect(sticker.emoji, sticker.name)"
          >
            {{ sticker.emoji }}
          </button>
        </div>
      </template>

      <!-- 自定义图片包 -->
      <template v-else-if="activeCustomPack">
        <div v-if="activeCustomPack.stickers.length > 0" class="grid grid-cols-4 gap-1.5">
          <button
            v-for="sticker in activeCustomPack.stickers"
            :key="sticker.id"
            class="flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-[10px] p-1 transition-[background,transform] duration-150 hover:bg-accent hover:scale-[1.08] active:scale-[0.94]"
            :title="sticker.name"
            @click="onImageSelect(sticker)"
          >
            <StickerThumb :mxc-url="sticker.mxcUrl" />
          </button>
        </div>
        <div
          v-else
          class="flex flex-col items-center justify-center py-8 text-xs text-muted-foreground gap-2"
        >
          <span>{{ t('chat.sticker_empty') }}</span>
          <button
            class="text-primary hover:underline text-xs"
            @click="emit('manage')"
          >
            {{ t('chat.sticker_manage_hint') }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

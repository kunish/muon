<script setup lang="ts">
import { fetchMediaBlobUrl } from '@matrix/media'
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  items: Array<{ id: string, label: string, avatar?: string }>
  selectedIndex: number
}>()

const emit = defineEmits<{
  select: [item: { id: string, label: string }]
}>()

const { t } = useI18n()

// 头像 blob URL 缓存：mxc:// → blob:
const avatarCache = ref<Record<string, string>>({})

// 列表容器 ref，用于 scrollIntoView
const listRef = ref<HTMLElement>()

// 当列表变化时异步加载头像
watch(() => props.items, (items) => {
  for (const item of items) {
    if (!item.avatar || avatarCache.value[item.avatar])
      continue
    fetchMediaBlobUrl(item.avatar, 32, 32).then((blob) => {
      if (blob) {
        avatarCache.value = { ...avatarCache.value, [item.avatar!]: blob }
      }
    })
  }
}, { immediate: true })

// 键盘导航时自动滚动选中项到可视区域
watch(() => props.selectedIndex, async () => {
  await nextTick()
  const container = listRef.value
  if (!container)
    return
  const selected = container.children[props.selectedIndex] as HTMLElement | undefined
  selected?.scrollIntoView({ block: 'nearest' })
})
</script>

<template>
  <div ref="listRef" class="bg-popover/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] py-1.5 max-h-[240px] overflow-y-auto min-w-[200px]">
    <button
      v-for="(item, i) in items"
      :key="item.id"
      class="w-full px-3 py-1.5 text-sm text-left flex items-center gap-2.5 transition-colors"
      :class="i === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'"
      @click="emit('select', item)"
    >
      <img
        v-if="item.avatar && avatarCache[item.avatar]"
        :src="avatarCache[item.avatar]"
        :alt="item.label"
        class="w-7 h-7 rounded-lg object-cover ring-1 ring-border/30 shrink-0"
      >
      <div
        v-else
        class="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0"
      >
        {{ item.label.slice(0, 1) }}
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-foreground text-[13px] font-medium">
          {{ item.label }}
        </div>
        <div class="truncate text-muted-foreground/60 text-[11px]">
          {{ item.id }}
        </div>
      </div>
    </button>
    <div v-if="items.length === 0" class="px-3 py-2 text-xs text-muted-foreground">
      {{ t('chat.mention_no_match') }}
    </div>
  </div>
</template>

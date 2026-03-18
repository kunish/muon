<script setup lang="ts">
import type { GifResult } from '@/shared/lib/gifSearch'
import { Search } from 'lucide-vue-next'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTrendingGifs, searchGifs } from '@/shared/lib/gifSearch'

const emit = defineEmits<{
  select: [gif: GifResult]
}>()

const { t } = useI18n()

const query = ref('')
const gifs = ref<GifResult[]>([])
const loading = ref(false)
const error = ref('')

let debounceTimer: ReturnType<typeof setTimeout> | null = null

async function loadTrending() {
  loading.value = true
  error.value = ''
  try {
    gifs.value = await getTrendingGifs(30)
  }
  catch (e) {
    error.value = t('chat.gif_load_failed')
    console.warn('[gif] trending error', e)
  }
  finally {
    loading.value = false
  }
}

async function doSearch(q: string) {
  if (!q.trim()) {
    loadTrending()
    return
  }
  loading.value = true
  error.value = ''
  try {
    gifs.value = await searchGifs(q.trim(), 30)
  }
  catch (e) {
    error.value = t('chat.gif_search_failed')
    console.warn('[gif] search error', e)
  }
  finally {
    loading.value = false
  }
}

watch(query, (val) => {
  if (debounceTimer)
    clearTimeout(debounceTimer)
  debounceTimer = setTimeout(doSearch, 300, val)
})

onUnmounted(() => {
  if (debounceTimer)
    clearTimeout(debounceTimer)
})

onMounted(() => loadTrending())
</script>

<template>
  <div class="gif-picker flex flex-col bg-background border border-border rounded-xl shadow-xl overflow-hidden">
    <!-- 搜索栏 -->
    <div class="px-2.5 pt-2.5 pb-1.5">
      <div class="relative">
        <Search
          class="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/40"
          :size="13"
        />
        <input
          v-model="query"
          type="text"
          :placeholder="t('chat.search_gif')"
          class="w-full h-[30px] pl-7 pr-2.5 text-xs rounded-lg bg-muted/50 border border-transparent outline-none placeholder:text-muted-foreground/40 focus:bg-muted/80 focus:border-ring/20 transition-all"
        >
      </div>
    </div>

    <!-- 内容区 -->
    <div class="gif-grid-scroll flex-1 overflow-y-auto px-2.5 pb-2">
      <!-- 加载中 -->
      <div v-if="loading && gifs.length === 0" class="py-8 text-center text-xs text-muted-foreground">
        {{ t('chat.gif_loading') }}
      </div>

      <!-- 错误 -->
      <div v-else-if="error" class="py-8 text-center text-xs text-muted-foreground">
        {{ error }}
      </div>

      <!-- 无结果 -->
      <div v-else-if="gifs.length === 0" class="py-8 text-center text-xs text-muted-foreground">
        {{ t('chat.gif_not_found') }}
      </div>

      <!-- GIF 网格 -->
      <div v-else class="grid grid-cols-2 gap-1.5">
        <button
          v-for="gif in gifs"
          :key="gif.id"
          class="gif-cell rounded-lg overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all"
          @click="emit('select', gif)"
        >
          <img
            :src="gif.previewUrl"
            :alt="gif.title"
            class="w-full h-full object-cover"
            loading="lazy"
          >
        </button>
      </div>
    </div>

    <!-- 底部 Tenor 标识 -->
    <div class="flex items-center justify-center border-t border-border bg-muted/30 px-2 py-1">
      <span class="text-[10px] text-muted-foreground/50">{{ t('chat.gif_powered_by') }}</span>
    </div>
  </div>
</template>

<style scoped>
.gif-picker {
  width: min(360px, calc(100vw - 16px));
  height: min(400px, calc(100vh - 24px));
}

.gif-grid-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.gif-cell {
  aspect-ratio: 4 / 3;
  cursor: pointer;
  background: var(--color-muted);
  transition:
    transform 0.15s,
    box-shadow 0.15s;
}

.gif-cell:hover {
  transform: scale(1.02);
}

.gif-cell:active {
  transform: scale(0.98);
}
</style>

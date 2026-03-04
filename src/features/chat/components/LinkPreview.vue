<script setup lang="ts">
import { fetch } from '@tauri-apps/plugin-http'
import { openUrl } from '@tauri-apps/plugin-opener'
import { ExternalLink, Link2 } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  url: string
}>()

const { t } = useI18n()

const title = ref('')
const description = ref('')
const favicon = ref('')
const ogImage = ref('')
const loading = ref(true)
const failed = ref(false)

// 组件卸载标志：仅控制是否写入 ref，不中断共享 fetch
let unmounted = false
// favicon 加载失败时的回退标记，防止无限循环
let faviconFallbackUsed = false

// ── 模块级 OG 缓存 ──────────────────────────────────────────────
interface OgCacheEntry {
  title: string
  description: string
  favicon: string
  ogImage: string
}

const _g = globalThis as any
if (!_g.__ogCache)
  _g.__ogCache = new Map<string, OgCacheEntry>()
if (!_g.__ogInflight)
  _g.__ogInflight = new Map<string, Promise<OgCacheEntry | null>>()
const OG_CACHE: Map<string, OgCacheEntry> = _g.__ogCache
// 同一 URL 并发去重：多个组件同时请求同一 URL 时共享同一个 Promise
const OG_INFLIGHT: Map<string, Promise<OgCacheEntry | null>> = _g.__ogInflight
const OG_CACHE_MAX = 256
// ────────────────────────────────────────────────────────────────

const domain = computed(() => {
  try {
    return new URL(props.url).hostname
  }
  catch {
    return ''
  }
})

const origin = computed(() => {
  try {
    return new URL(props.url).origin
  }
  catch {
    return ''
  }
})

function applyResult(entry: OgCacheEntry) {
  title.value = entry.title
  description.value = entry.description
  favicon.value = entry.favicon
  ogImage.value = entry.ogImage
  failed.value = false
  loading.value = false
}

function resolveFavicon(doc: Document, baseUrl: string, originUrl: string): string {
  // 按优先级尝试多种 favicon 声明方式
  const selectors = [
    'link[rel="icon"][type="image/svg+xml"]',
    'link[rel="icon"][sizes="32x32"]',
    'link[rel="icon"][sizes="16x16"]',
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]',
  ]
  for (const sel of selectors) {
    const href = doc.querySelector(sel)?.getAttribute('href')
    if (href) {
      try {
        return new URL(href, baseUrl).href
      }
      catch {
        return href
      }
    }
  }
  return originUrl ? `${originUrl}/favicon.ico` : ''
}

// 独立于组件生命周期的 fetch，使用自己的 AbortController（仅超时）
async function fetchOgData(url: string, domainVal: string, originVal: string): Promise<OgCacheEntry | null> {
  const ac = new AbortController()
  const timeoutId = setTimeout(() => ac.abort(), 5000)

  try {
    const resp = await fetch(url, { signal: ac.signal }).catch(() => null)
    if (!resp || !resp.ok) {
      clearTimeout(timeoutId)
      return {
        title: domainVal,
        description: '',
        favicon: originVal ? `${originVal}/favicon.ico` : '',
        ogImage: '',
      }
    }

    const html = await resp.text()
    clearTimeout(timeoutId)

    const doc = new DOMParser().parseFromString(html, 'text/html')

    return {
      title: doc.querySelector('meta[property="og:title"]')?.getAttribute('content')
        || doc.querySelector('title')?.textContent
        || domainVal,
      description: doc.querySelector('meta[property="og:description"]')?.getAttribute('content')
        || doc.querySelector('meta[name="description"]')?.getAttribute('content')
        || '',
      ogImage: doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
      favicon: resolveFavicon(doc, url, originVal),
    }
  }
  catch {
    clearTimeout(timeoutId)
    // 超时或网络错误 → 返回 null 表示失败，不写入缓存以便后续重试
    return null
  }
}

onMounted(async () => {
  // 1. 命中缓存 → 直接使用
  const cached = OG_CACHE.get(props.url)
  if (cached) {
    applyResult(cached)
    return
  }

  // 2. 并发去重：复用已在进行中的请求
  let promise = OG_INFLIGHT.get(props.url)
  if (!promise) {
    // 快照当前值，避免闭包引用响应式 computed
    promise = fetchOgData(props.url, domain.value, origin.value)
    OG_INFLIGHT.set(props.url, promise)
  }

  const entry = await promise
  OG_INFLIGHT.delete(props.url)

  // 组件已卸载，不操作 ref
  if (unmounted)
    return

  if (entry) {
    // 3. 写入缓存（LRU 淘汰最早条目）
    if (OG_CACHE.size >= OG_CACHE_MAX) {
      const firstKey = OG_CACHE.keys().next().value
      if (firstKey !== undefined)
        OG_CACHE.delete(firstKey)
    }
    OG_CACHE.set(props.url, entry)
    applyResult(entry)
  }
  else {
    // 失败：不缓存，允许后续重试；当前组件显示降级
    title.value = domain.value
    favicon.value = origin.value ? `${origin.value}/favicon.ico` : ''
    loading.value = false
  }
})

onUnmounted(() => {
  unmounted = true
})

function openInBrowser() {
  if (!loading.value) {
    openUrl(props.url)
  }
}

function onFaviconError() {
  if (!faviconFallbackUsed && domain.value) {
    // 二次回退：使用 Google favicon 服务
    faviconFallbackUsed = true
    favicon.value = `https://www.google.com/s2/favicons?sz=32&domain=${domain.value}`
  }
  else {
    // Google 服务也失败，彻底放弃
    favicon.value = ''
  }
}
</script>

<template>
  <div
    v-if="!failed"
    role="link"
    class="link-card block mt-2 rounded-lg border border-border/50 bg-background overflow-hidden hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-200 no-underline max-w-[400px] cursor-pointer"
    :class="{ 'pointer-events-none': loading }"
    @click.stop="openInBrowser"
  >
    <!-- URL display -->
    <div class="px-3 pt-2.5 pb-1">
      <div class="text-xs text-primary truncate">
        {{ url }}
      </div>
    </div>

    <!-- Content: skeleton during loading, real content after -->
    <div class="flex items-start gap-3 px-3 pb-2.5">
      <div class="flex-1 min-w-0">
        <!-- Domain with favicon -->
        <div class="flex items-center gap-1.5 mb-1">
          <template v-if="loading">
            <div class="w-4 h-4 rounded-sm shrink-0 bg-muted/60 animate-pulse" />
            <div class="h-3 w-20 rounded bg-muted/60 animate-pulse" />
          </template>
          <template v-else>
            <img
              v-if="favicon"
              :src="favicon"
              class="w-4 h-4 rounded-sm shrink-0"
              @error="onFaviconError"
            >
            <Link2 v-else :size="12" class="text-muted-foreground/50 shrink-0" />
            <span class="text-[11px] text-muted-foreground truncate">{{ domain }}</span>
          </template>
        </div>

        <!-- Title -->
        <div v-if="loading" class="h-4 w-3/4 rounded bg-muted/60 animate-pulse" />
        <div v-else class="text-sm font-medium text-foreground leading-snug line-clamp-1">
          {{ title }}
        </div>

        <!-- Description: always reserve space (min-h) to prevent layout shift -->
        <div v-if="loading" class="mt-1 space-y-1">
          <div class="h-3 w-full rounded bg-muted/50 animate-pulse" />
          <div class="h-3 w-2/3 rounded bg-muted/50 animate-pulse" />
        </div>
        <div v-else-if="description" class="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
          {{ description }}
        </div>
      </div>

      <!-- OG Image placeholder during loading / real image after -->
      <div
        v-if="loading"
        class="w-[60px] h-[60px] rounded-md shrink-0 bg-muted/50 animate-pulse"
      />
      <img
        v-else-if="ogImage"
        :src="ogImage"
        class="w-[60px] h-[60px] rounded-md object-cover shrink-0"
        @error="ogImage = ''"
      >
    </div>

    <!-- Bottom bar with more info icon -->
    <div class="flex items-center gap-1 px-3 py-1.5 bg-muted/30 border-t border-border/30">
      <ExternalLink :size="10" class="text-muted-foreground/40" />
      <span class="text-[10px] text-muted-foreground/50">{{ t('chat.link_open') }}</span>
    </div>
  </div>
</template>

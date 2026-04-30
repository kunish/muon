<script setup lang="ts">
import { ExternalLink, Link2 } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { fetch } from '@/electron/http'
import { openUrl } from '@/electron/opener'
import { getPreviewAssetUrl, getPreviewRequestUrl, isHtmlPreviewResponse, readLimitedText } from '../lib/linkPreview'

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
const MAX_PREVIEW_REDIRECTS = 5
const MAX_PREVIEW_IMAGE_BYTES = 2 * 1024 * 1024
const OG_CACHE_VERSION = 3
const PREVIEW_CRAWLER_USER_AGENT = 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'
const PREVIEW_BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const PREVIEW_HTML_HEADER_VARIANTS: Array<Record<string, string>> = [
  createPreviewHtmlHeaders(PREVIEW_CRAWLER_USER_AGENT),
  createPreviewHtmlHeaders(PREVIEW_BROWSER_USER_AGENT),
]
const PREVIEW_IMAGE_HEADERS: Record<string, string> = {
  'accept': 'image/*,*/*;q=0.8',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'user-agent': PREVIEW_CRAWLER_USER_AGENT,
}
let faviconBlobUrl = ''
let ogImageBlobUrl = ''
// ── 模块级 OG 缓存 ──────────────────────────────────────────────
interface OgCacheEntry {
  title: string
  description: string
  favicon: string
  ogImage: string
  isFallback?: boolean
  previewVersion: number
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

function createPreviewHtmlHeaders(userAgent: string): Record<string, string> {
  return {
    'accept': 'text/html,application/xhtml+xml',
    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'user-agent': userAgent,
  }
}

const domain = computed(() => {
  try {
    return new URL(props.url).hostname
  }
  catch {
    return ''
  }
})

function applyResult(entry: OgCacheEntry) {
  title.value = entry.title
  description.value = entry.description
  setFavicon('')
  setOgImage('')
  failed.value = false
  loading.value = false
  void hydrateAssetImages(entry)
}

function createFallbackEntry(url: string, domainVal: string): OgCacheEntry {
  return {
    title: domainVal || url,
    description: '',
    favicon: '',
    ogImage: '',
    isFallback: true,
    previewVersion: OG_CACHE_VERSION,
  }
}

function getMetaContent(doc: Document, selectors: string[]): string {
  for (const selector of selectors) {
    const content = doc.querySelector<HTMLMetaElement>(selector)?.getAttribute('content')?.trim()
    if (content)
      return content
  }
  return ''
}

function getFaviconUrl(doc: Document, baseUrl: string): string {
  const iconLink = Array
    .from(doc.querySelectorAll<HTMLLinkElement>('link[rel][href]'))
    .find((link) => {
      const rel = link.getAttribute('rel')?.toLowerCase() ?? ''
      return rel.split(/\s+/).includes('icon') || rel.includes('apple-touch-icon')
    })
  return getPreviewAssetUrl(iconLink?.getAttribute('href') || '/favicon.ico', baseUrl)
}

function isRedirectResponse(resp: Response): boolean {
  return resp.status >= 300 && resp.status < 400
}

async function fetchPreviewResponse(
  previewUrl: URL,
  signal: AbortSignal,
  headers: Record<string, string>,
): Promise<{ resp: Response, baseUrl: string } | null> {
  let currentUrl = previewUrl
  for (let redirectCount = 0; redirectCount <= MAX_PREVIEW_REDIRECTS; redirectCount += 1) {
    const resp = await fetch(currentUrl.href, {
      headers,
      redirect: 'manual',
      signal,
    }).catch(() => null)
    if (!resp)
      return null

    if (!isRedirectResponse(resp))
      return { resp, baseUrl: resp.url || currentUrl.href }

    const location = resp.headers.get('location')
    if (!location)
      return { resp, baseUrl: currentUrl.href }

    const nextUrl = getPreviewRequestUrl(new URL(location, currentUrl.href).href)
    if (!nextUrl)
      return null
    currentUrl = nextUrl
  }
  return null
}

function isAllowedImageResponse(resp: Response): boolean {
  if (!resp.ok)
    return false

  const contentLength = resp.headers.get('content-length')
  if (contentLength !== null) {
    const bytes = Number(contentLength)
    if (!Number.isFinite(bytes) || bytes > MAX_PREVIEW_IMAGE_BYTES)
      return false
  }

  const contentType = resp.headers.get('content-type')?.toLowerCase() ?? ''
  return contentType.startsWith('image/')
}

async function fetchPreviewImageBlobUrl(rawUrl: string): Promise<string> {
  const imageUrl = getPreviewRequestUrl(rawUrl)
  if (!imageUrl || typeof URL.createObjectURL !== 'function')
    return ''

  const ac = new AbortController()
  const timeoutId = setTimeout(() => ac.abort(), 5000)
  try {
    const resp = await fetch(imageUrl.href, {
      headers: PREVIEW_IMAGE_HEADERS,
      redirect: 'follow',
      signal: ac.signal,
    }).catch(() => null)
    if (!resp || !isAllowedImageResponse(resp))
      return ''

    const blob = await resp.blob()
    if (!blob.size || blob.size > MAX_PREVIEW_IMAGE_BYTES)
      return ''
    return URL.createObjectURL(blob)
  }
  catch {
    return ''
  }
  finally {
    clearTimeout(timeoutId)
  }
}

function revokePreviewBlobUrl(url: string) {
  if (url.startsWith('blob:') && typeof URL.revokeObjectURL === 'function')
    URL.revokeObjectURL(url)
}

function setFavicon(url: string) {
  if (faviconBlobUrl && faviconBlobUrl !== url)
    revokePreviewBlobUrl(faviconBlobUrl)
  faviconBlobUrl = url.startsWith('blob:') ? url : ''
  favicon.value = url
}

function setOgImage(url: string) {
  if (ogImageBlobUrl && ogImageBlobUrl !== url)
    revokePreviewBlobUrl(ogImageBlobUrl)
  ogImageBlobUrl = url.startsWith('blob:') ? url : ''
  ogImage.value = url
}

async function hydrateAssetImages(entry: OgCacheEntry) {
  if (entry.favicon) {
    const faviconUrl = await fetchPreviewImageBlobUrl(entry.favicon)
    if (!unmounted && faviconUrl)
      setFavicon(faviconUrl)
  }

  if (entry.ogImage) {
    const imageUrl = await fetchPreviewImageBlobUrl(entry.ogImage)
    if (!unmounted && imageUrl)
      setOgImage(imageUrl)
  }
}

function createEntryFromDocument(doc: Document, baseUrl: string, domainVal: string): OgCacheEntry {
  const siteName = getMetaContent(doc, [
    'meta[property="og:site_name"]',
    'meta[name="application-name"]',
  ])

  return {
    title: getMetaContent(doc, [
      'meta[property="og:title"]',
      'meta[property="twitter:title"]',
      'meta[name="twitter:title"]',
    ])
    || doc.querySelector('title')?.textContent?.trim()
    || siteName
    || domainVal,
    description: getMetaContent(doc, [
      'meta[property="og:description"]',
      'meta[property="twitter:description"]',
      'meta[name="twitter:description"]',
      'meta[name="description"]',
    ]),
    ogImage: getPreviewAssetUrl(getMetaContent(doc, [
      'meta[property="og:image"]',
      'meta[property="og:image:url"]',
      'meta[property="twitter:image"]',
      'meta[property="twitter:image:src"]',
      'meta[name="twitter:image"]',
      'meta[name="twitter:image:src"]',
    ]), baseUrl),
    favicon: getFaviconUrl(doc, baseUrl),
    previewVersion: OG_CACHE_VERSION,
  }
}

function hasUsefulPreviewMetadata(entry: OgCacheEntry, domainVal: string): boolean {
  return Boolean(entry.description || entry.ogImage || (entry.title && entry.title !== domainVal))
}

// 独立于组件生命周期的 fetch，使用自己的 AbortController（仅超时）
async function fetchOgData(url: string, domainVal: string): Promise<OgCacheEntry | null> {
  const previewUrl = getPreviewRequestUrl(url)
  if (!previewUrl)
    return null

  const ac = new AbortController()
  const timeoutId = setTimeout(() => ac.abort(), 5000)

  try {
    for (const headers of PREVIEW_HTML_HEADER_VARIANTS) {
      const previewResponse = await fetchPreviewResponse(previewUrl, ac.signal, headers)
      const resp = previewResponse?.resp
      if (!resp || !isHtmlPreviewResponse(resp))
        continue

      const html = await readLimitedText(resp)
      if (html === null)
        continue

      const doc = new DOMParser().parseFromString(html, 'text/html')
      const entry = createEntryFromDocument(doc, previewResponse.baseUrl, domainVal)
      if (hasUsefulPreviewMetadata(entry, domainVal))
        return entry
    }

    return createFallbackEntry(url, domainVal)
  }
  catch {
    // 超时或网络错误时保留基础链接卡片，但不写入缓存，以便后续重试元信息。
    return createFallbackEntry(url, domainVal)
  }
  finally {
    clearTimeout(timeoutId)
  }
}

onMounted(async () => {
  // 1. 命中缓存 → 直接使用
  const cached = OG_CACHE.get(props.url)
  if (cached?.previewVersion === OG_CACHE_VERSION) {
    applyResult(cached)
    return
  }
  if (cached)
    OG_CACHE.delete(props.url)

  // 2. 并发去重：复用已在进行中的请求
  let promise = OG_INFLIGHT.get(props.url)
  if (!promise) {
    // 快照当前值，避免闭包引用响应式 computed
    promise = fetchOgData(props.url, domain.value)
    OG_INFLIGHT.set(props.url, promise)
  }

  const entry = await promise
  OG_INFLIGHT.delete(props.url)

  // 组件已卸载，不操作 ref
  if (unmounted)
    return

  if (entry) {
    // 3. 写入缓存（LRU 淘汰最早条目）
    if (!entry.isFallback && OG_CACHE.size >= OG_CACHE_MAX) {
      const firstKey = OG_CACHE.keys().next().value
      if (firstKey !== undefined)
        OG_CACHE.delete(firstKey)
    }
    if (!entry.isFallback)
      OG_CACHE.set(props.url, entry)
    applyResult(entry)
  }
  else {
    // 安全策略拦截的 URL 不显示预览卡片。
    failed.value = true
    loading.value = false
  }
})

onUnmounted(() => {
  unmounted = true
  setFavicon('')
  setOgImage('')
})

async function openInBrowser() {
  if (!loading.value) {
    try {
      await openUrl(props.url)
    }
    catch {
      toast.error(t('chat.link_open_failed'))
    }
  }
}
</script>

<template>
  <div
    v-if="!failed"
    role="link"
    class="link-card block mt-2 w-full max-w-[460px] cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-background no-underline transition-[border-color,box-shadow] duration-200 hover:border-border hover:shadow-[0_4px_14px_rgba(15,23,42,0.08)]"
    :class="{ 'pointer-events-none': loading }"
    @click.stop="openInBrowser"
  >
    <!-- URL display -->
    <div class="px-4 pt-3">
      <div class="truncate text-[13px] leading-5 text-primary">
        {{ url }}
      </div>
    </div>

    <!-- Content: skeleton during loading, real content after -->
    <div class="flex items-start gap-3.5 px-4 pb-3 pt-1">
      <div class="flex-1 min-w-0">
        <!-- Domain with favicon -->
        <div class="mb-1.5 flex h-5 items-center gap-1.5">
          <template v-if="loading">
            <div class="w-4 h-4 rounded-sm shrink-0 bg-muted/60 animate-pulse" />
            <div class="h-3 w-20 rounded bg-muted/60 animate-pulse" />
          </template>
          <template v-else>
            <img
              v-if="favicon"
              :src="favicon"
              alt=""
              class="w-4 h-4 rounded-sm shrink-0"
              @error="setFavicon('')"
            >
            <Link2 v-else :size="12" class="text-muted-foreground/50 shrink-0" />
            <span class="truncate text-xs text-muted-foreground">{{ domain }}</span>
          </template>
        </div>

        <!-- Title -->
        <div class="h-5">
          <div v-if="loading" class="h-4 w-3/4 rounded bg-muted/60 animate-pulse" />
          <div v-else class="line-clamp-1 text-[15px] font-medium leading-5 text-foreground">
            {{ title }}
          </div>
        </div>

        <div
          data-testid="link-preview-description-slot"
          class="mt-1.5 min-h-[38px]"
        >
          <template v-if="loading">
            <div class="space-y-1 pt-0.5">
              <div class="h-3 w-full rounded bg-muted/50 animate-pulse" />
              <div class="h-3 w-2/3 rounded bg-muted/50 animate-pulse" />
            </div>
          </template>
          <div v-else-if="description" class="line-clamp-2 text-[13px] leading-[19px] text-muted-foreground">
            {{ description }}
          </div>
        </div>
      </div>

      <div
        data-testid="link-preview-media-slot"
        class="flex h-[92px] w-[124px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/30 bg-muted/30"
      >
        <div
          v-if="loading"
          class="h-full w-full bg-muted/50 animate-pulse"
        />
        <img
          v-else-if="ogImage"
          :src="ogImage"
          alt=""
          class="h-full w-full object-contain"
          @error="setOgImage('')"
        >
        <Link2 v-else :size="22" class="text-muted-foreground/25" />
      </div>
    </div>

    <!-- Bottom bar with more info icon -->
    <div class="flex h-[26px] items-center gap-1 border-t border-border/30 bg-muted/30 px-3">
      <ExternalLink :size="10" class="text-muted-foreground/40" />
      <span class="text-[10px] text-muted-foreground/50">{{ t('chat.link_open') }}</span>
    </div>
  </div>
</template>

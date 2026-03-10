import type { Ref } from 'vue'
import { fetchMediaBlobUrl } from '@matrix/media'
import { ref, watch } from 'vue'

/** 全局 mxc → blob URL 缓存 */
const cache = new Map<string, string>()
/** 正在加载的 Promise 去重 */
const pending = new Map<string, Promise<string>>()

async function resolve(mxcUrl: string, width?: number, height?: number): Promise<string> {
  const key = `${mxcUrl}|${width ?? 0}|${height ?? 0}`
  if (cache.has(key))
    return cache.get(key)!

  if (pending.has(key))
    return pending.get(key)!

  const p = fetchMediaBlobUrl(mxcUrl, width, height).then((blob) => {
    if (blob)
      cache.set(key, blob)
    pending.delete(key)
    return blob
  })
  pending.set(key, p)
  return p
}

/**
 * 将 mxc:// URL 转为认证后的 blob: URL（响应式）
 */
export function useAuthMedia(
  mxcUrl: Ref<string | undefined> | (() => string | undefined),
  width = 48,
  height = 48,
) {
  const src = ref<string | undefined>()

  watch(mxcUrl, async (url) => {
    if (!url) {
      src.value = undefined
      return
    }
    // 已经是 blob/http(非 mxc) 直接用
    if (!url.startsWith('mxc://')) {
      src.value = url
      return
    }
    src.value = await resolve(url, width, height)
  }, { immediate: true })

  return src
}

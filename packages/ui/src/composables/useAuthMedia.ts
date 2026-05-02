import type { Ref } from 'vue'
import { ref, watch } from 'vue'

export type AuthMediaResolver = (mxcUrl: string, width?: number, height?: number) => Promise<string | undefined>

let authMediaResolver: AuthMediaResolver | undefined

const cache = new Map<string, string | undefined>()
const pending = new Map<string, Promise<string | undefined>>()

export function setAuthMediaResolver(resolver: AuthMediaResolver | undefined): void {
  authMediaResolver = resolver
  cache.clear()
  pending.clear()
}

async function resolve(mxcUrl: string, width?: number, height?: number): Promise<string | undefined> {
  if (!authMediaResolver)
    return undefined

  const key = `${mxcUrl}|${width ?? 0}|${height ?? 0}`
  if (cache.has(key))
    return cache.get(key)

  if (pending.has(key))
    return pending.get(key)

  const p = authMediaResolver(mxcUrl, width, height).then((blob) => {
    cache.set(key, blob)
    pending.delete(key)
    return blob
  })
  pending.set(key, p)
  return p
}

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
    if (!url.startsWith('mxc://')) {
      src.value = url
      return
    }
    src.value = await resolve(url, width, height)
  }, { immediate: true })

  return src
}

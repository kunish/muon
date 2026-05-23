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

function resolve(mxcUrl: string, width?: number, height?: number): Promise<string | undefined> {
  if (!authMediaResolver) return Promise.resolve(undefined)

  const key = `${mxcUrl}|${width ?? 0}|${height ?? 0}`
  if (cache.has(key)) return Promise.resolve(cache.get(key))

  const pendingRequest = pending.get(key)
  if (pendingRequest) return pendingRequest

  const p = authMediaResolver(mxcUrl, width, height).then((blob) => {
    cache.set(key, blob)
    pending.delete(key)
    return blob
  })
  pending.set(key, p)
  return p
}

export function useAuthMedia(mxcUrl: Ref<string | undefined> | (() => string | undefined), width = 48, height = 48) {
  const src = ref<string | undefined>()

  watch(
    mxcUrl,
    (url) => {
      if (!url) {
        src.value = undefined
        return
      }
      if (!url.startsWith('mxc://')) {
        src.value = url
        return
      }
      void resolve(url, width, height).then((resolved) => {
        src.value = resolved
      })
    },
    { immediate: true },
  )

  return src
}

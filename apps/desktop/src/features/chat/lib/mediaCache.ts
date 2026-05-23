/**
 * Local media cache for instant display (秒下).
 * Uses IndexedDB via CacheStorage-like API to store downloaded media blobs.
 * Cached entries include expiry and size management.
 */

import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { fromPromise, runDesktopEffect } from '@/shared/lib/effect'

interface CacheEntry {
  blob: Blob
  contentType: string
  cachedAt: number
  size: number
}

/** Entry as stored in IndexedDB (includes keyPath) */
interface StoredEntry extends CacheEntry {
  key: string
}

interface CacheStats {
  entryCount: number
  totalSize: number
}

const DB_NAME = 'MuonMediaCache'
const DB_VERSION = 1
const STORE_NAME = 'media'
// Max cache size: 200MB. Cleanup starts at 150MB threshold.
const CLEANUP_THRESHOLD = 150 * 1024 * 1024
const MAX_ENTRY_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

let dbPromise: Promise<IDBDatabase> | null = null

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        store.createIndex('cachedAt', 'cachedAt', { unique: false })
        store.createIndex('size', 'size', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return dbPromise
}

function getDbEffect(): DesktopEffect<IDBDatabase> {
  return fromPromise(() => getDb())
}

function buildKey(mxcUrl: string, width?: number, height?: number): string {
  const base = mxcUrl.replace('mxc://', '')
  if (width && height) return `${base}__${width}x${height}`
  return base
}

function readEntry(db: IDBDatabase, key: string): Promise<StoredEntry | undefined> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(key)

    request.onsuccess = () => resolve(request.result as StoredEntry | undefined)
    request.onerror = () => resolve(undefined)
  })
}

export function getCachedMediaEffect(mxcUrl: string, width?: number, height?: number): DesktopEffect<Blob | null> {
  return Effect.gen(function* () {
    const db = yield* getDbEffect()
    const key = buildKey(mxcUrl, width, height)

    const entry = yield* fromPromise(() => readEntry(db, key))
    if (!entry) return null

    if (Date.now() - entry.cachedAt > MAX_ENTRY_AGE_MS) {
      void removeCachedMedia(mxcUrl, width, height)
      return null
    }

    return new Blob([entry.blob], { type: entry.contentType })
  }).pipe(Effect.catchAll(() => Effect.succeed(null)))
}

export function getCachedMedia(mxcUrl: string, width?: number, height?: number): Promise<Blob | null> {
  return runDesktopEffect(getCachedMediaEffect(mxcUrl, width, height))
}

function putEntry(db: IDBDatabase, entry: StoredEntry): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

export function cacheMediaEffect(mxcUrl: string, blob: Blob, width?: number, height?: number): DesktopEffect<void> {
  return Effect.gen(function* () {
    const db = yield* getDbEffect()
    const key = buildKey(mxcUrl, width, height)

    yield* checkAndCleanupEffect(db, blob.size)
    yield* fromPromise(() =>
      putEntry(db, {
        key,
        blob,
        contentType: blob.type,
        cachedAt: Date.now(),
        size: blob.size,
      }),
    )
  }).pipe(Effect.catchAll(() => Effect.void))
}

export function cacheMedia(mxcUrl: string, blob: Blob, width?: number, height?: number): Promise<void> {
  return runDesktopEffect(cacheMediaEffect(mxcUrl, blob, width, height))
}

function deleteEntry(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

export function removeCachedMediaEffect(mxcUrl: string, width?: number, height?: number): DesktopEffect<void> {
  return Effect.gen(function* () {
    const db = yield* getDbEffect()
    const key = buildKey(mxcUrl, width, height)
    yield* fromPromise(() => deleteEntry(db, key))
  }).pipe(Effect.catchAll(() => Effect.void))
}

export function removeCachedMedia(mxcUrl: string, width?: number, height?: number): Promise<void> {
  return runDesktopEffect(removeCachedMediaEffect(mxcUrl, width, height))
}

export function getCacheStatsEffect(): DesktopEffect<CacheStats> {
  return Effect.gen(function* () {
    const db = yield* getDbEffect()
    return yield* getStatsFromDbEffect(db)
  }).pipe(Effect.catchAll(() => Effect.succeed({ entryCount: 0, totalSize: 0 })))
}

export function getCacheStats(): Promise<CacheStats> {
  return runDesktopEffect(getCacheStatsEffect())
}

function checkAndCleanupEffect(db: IDBDatabase, newEntrySize: number): DesktopEffect<void> {
  return Effect.gen(function* () {
    const stats = yield* getStatsFromDbEffect(db)

    if (stats.totalSize + newEntrySize < CLEANUP_THRESHOLD) return

    const entries = yield* getEntriesSortedByAgeEffect(db)

    let freed = 0
    const toDelete: string[] = []

    for (const entry of entries) {
      if (stats.totalSize - freed + newEntrySize < CLEANUP_THRESHOLD) break

      toDelete.push(entry.key)
      freed += entry.size
    }

    if (toDelete.length === 0) return

    yield* fromPromise(
      () =>
        new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          const store = tx.objectStore(STORE_NAME)
          for (const key of toDelete) store.delete(key)
          tx.oncomplete = () => resolve()
          tx.onerror = () => resolve()
        }),
    )
  })
}

function getStatsFromDbEffect(db: IDBDatabase): DesktopEffect<CacheStats> {
  return fromPromise(
    () =>
      new Promise<CacheStats>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        let entryCount = 0
        let totalSize = 0

        store.count().onsuccess = (e) => {
          entryCount = (e.target as IDBRequest).result
        }

        store.openCursor().onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
          if (cursor) {
            totalSize += (cursor.value as StoredEntry).size || 0
            cursor.continue()
          }
        }

        tx.oncomplete = () => resolve({ entryCount, totalSize })
        tx.onerror = () => resolve({ entryCount: 0, totalSize: 0 })
      }),
  )
}

function getEntriesSortedByAgeEffect(db: IDBDatabase): DesktopEffect<StoredEntry[]> {
  return fromPromise(
    () =>
      new Promise<StoredEntry[]>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const index = store.index('cachedAt')
        const entries: StoredEntry[] = []

        index.openCursor().onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
          if (cursor) {
            entries.push(cursor.value as StoredEntry)
            cursor.continue()
          }
        }

        tx.oncomplete = () => {
          entries.sort((a, b) => a.cachedAt - b.cachedAt)
          resolve(entries)
        }
        tx.onerror = () => resolve([])
      }),
  )
}

export function clearMediaCacheEffect(): DesktopEffect<void> {
  return Effect.gen(function* () {
    const db = yield* getDbEffect()
    yield* fromPromise(
      () =>
        new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          tx.objectStore(STORE_NAME).clear()
          tx.oncomplete = () => resolve()
          tx.onerror = () => resolve()
        }),
    )
  }).pipe(Effect.catchAll(() => Effect.void))
}

export function clearMediaCache(): Promise<void> {
  return runDesktopEffect(clearMediaCacheEffect())
}

/**
 * Local media cache for instant display (秒下).
 * Uses IndexedDB via CacheStorage-like API to store downloaded media blobs.
 * Cached entries include expiry and size management.
 */

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
  if (dbPromise)
    return dbPromise

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

function buildKey(mxcUrl: string, width?: number, height?: number): string {
  const base = mxcUrl.replace('mxc://', '')
  if (width && height)
    return `${base}__${width}x${height}`
  return base
}

export async function getCachedMedia(
  mxcUrl: string,
  width?: number,
  height?: number,
): Promise<Blob | null> {
  try {
    const db = await getDb()
    const key = buildKey(mxcUrl, width, height)

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(key)

      request.onsuccess = () => {
        const entry = request.result as { blob: Blob, contentType: string, cachedAt: number } | undefined
        if (!entry) {
          resolve(null)
          return
        }

        if (Date.now() - entry.cachedAt > MAX_ENTRY_AGE_MS) {
          void removeCachedMedia(mxcUrl, width, height)
          resolve(null)
          return
        }

        const blob = new Blob([entry.blob], { type: entry.contentType })
        resolve(blob)
      }

      request.onerror = () => resolve(null)
    })
  }
  catch {
    return null
  }
}

export async function cacheMedia(
  mxcUrl: string,
  blob: Blob,
  width?: number,
  height?: number,
): Promise<void> {
  try {
    const db = await getDb()
    const key = buildKey(mxcUrl, width, height)

    await checkAndCleanup(db, blob.size)

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.put({
        key,
        blob,
        contentType: blob.type,
        cachedAt: Date.now(),
        size: blob.size,
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  }
  catch {
    // IndexedDB might be unavailable (private browsing), silently fail
  }
}

export async function removeCachedMedia(
  mxcUrl: string,
  width?: number,
  height?: number,
): Promise<void> {
  try {
    const db = await getDb()
    const key = buildKey(mxcUrl, width, height)

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  }
  catch {
    // ignore
  }
}

export async function getCacheStats(): Promise<CacheStats> {
  try {
    const db = await getDb()

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const countRequest = store.count()
      let entryCount = 0

      countRequest.onsuccess = () => {
        entryCount = countRequest.result
      }

      const cursorRequest = store.openCursor()
      let totalSize = 0

      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result
        if (cursor) {
          const entry = cursor.value as CacheEntry
          totalSize += entry.size || 0
          cursor.continue()
        }
      }

      tx.oncomplete = () => {
        resolve({ entryCount, totalSize })
      }
      tx.onerror = () => resolve({ entryCount: 0, totalSize: 0 })
    })
  }
  catch {
    return { entryCount: 0, totalSize: 0 }
  }
}

async function checkAndCleanup(db: IDBDatabase, newEntrySize: number): Promise<void> {
  const stats = await getStatsFromDb(db)

  if (stats.totalSize + newEntrySize < CLEANUP_THRESHOLD)
    return

  const entries = await getEntriesSortedByAge(db)

  let freed = 0
  const toDelete: string[] = []

  for (const entry of entries) {
    if (stats.totalSize - freed + newEntrySize < CLEANUP_THRESHOLD)
      break

    toDelete.push(entry.key)
    freed += entry.size
  }

  if (toDelete.length === 0)
    return

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const key of toDelete)
      store.delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

function getStatsFromDb(db: IDBDatabase): Promise<CacheStats> {
  return new Promise((resolve) => {
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
  })
}

function getEntriesSortedByAge(db: IDBDatabase): Promise<StoredEntry[]> {
  return new Promise((resolve) => {
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
  })
}

export async function clearMediaCache(): Promise<void> {
  try {
    const db = await getDb()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  }
  catch {
    // ignore
  }
}

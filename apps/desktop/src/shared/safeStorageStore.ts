import type { z } from 'zod'

export interface SafeStorageLike {
  isAvailable: () => Promise<boolean>
  encrypt: (value: string) => Promise<string>
  decrypt: (value: string) => Promise<string>
}

export interface EncryptedStore<T> {
  read: () => Promise<T | null>
  write: (value: T) => Promise<void>
  clear: () => void
}

export type EncryptedStoreLogger = (message: string, error?: unknown) => void

interface EncryptedPayload {
  _enc: true
  data: string
}

function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { _enc?: unknown })._enc === true &&
    typeof (value as { data?: unknown }).data === 'string'
  )
}

export function makeEncryptedStore<T>(params: {
  key: string
  schema: z.ZodType<T>
  safeStorage: SafeStorageLike
  logger?: EncryptedStoreLogger
}): EncryptedStore<T> {
  const { key, schema, safeStorage, logger } = params
  const warn: EncryptedStoreLogger =
    logger ??
    ((message, error) => {
      console.warn(`[encryptedStore:${key}] ${message}`, error)
    })

  return {
    async read() {
      const raw = localStorage.getItem(key)
      if (!raw) return null

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch (err) {
        warn('failed to parse stored payload', err)
        return null
      }

      let candidate: unknown = parsed
      if (isEncryptedPayload(parsed) && (await safeStorage.isAvailable().catch(() => false))) {
        try {
          const decrypted = await safeStorage.decrypt(parsed.data)
          candidate = JSON.parse(decrypted)
        } catch (err) {
          warn('decrypt failed; treating session as invalid', err)
          return null
        }
      }

      const result = schema.safeParse(candidate)
      if (!result.success) {
        warn('stored payload failed schema validation; discarding')
        return null
      }
      return result.data
    },

    async write(value) {
      const json = JSON.stringify(value)
      let payload = json

      if (await safeStorage.isAvailable().catch(() => false)) {
        try {
          const encrypted = await safeStorage.encrypt(json)
          payload = JSON.stringify({ _enc: true, data: encrypted } satisfies EncryptedPayload)
        } catch (err) {
          warn('encrypt failed; persisting plaintext fallback', err)
          payload = json
        }
      }

      localStorage.setItem(key, payload)
    },

    clear() {
      localStorage.removeItem(key)
    },
  }
}

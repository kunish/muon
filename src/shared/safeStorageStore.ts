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

interface EncryptedPayload {
  _enc: true
  data: string
}

function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  return (
    typeof value === 'object'
    && value !== null
    && (value as { _enc?: unknown })._enc === true
    && typeof (value as { data?: unknown }).data === 'string'
  )
}

export function makeEncryptedStore<T>(params: {
  key: string
  schema: z.ZodType<T>
  safeStorage: SafeStorageLike
}): EncryptedStore<T> {
  const { key, schema, safeStorage } = params

  return {
    async read() {
      const raw = localStorage.getItem(key)
      if (!raw)
        return null

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      }
      catch {
        return null
      }

      let candidate: unknown = parsed
      if (isEncryptedPayload(parsed) && (await safeStorage.isAvailable().catch(() => false))) {
        try {
          const decrypted = await safeStorage.decrypt(parsed.data)
          candidate = JSON.parse(decrypted)
        }
        catch {
          return null
        }
      }

      const result = schema.safeParse(candidate)
      return result.success ? result.data : null
    },

    async write(value) {
      const json = JSON.stringify(value)
      let payload = json

      if (await safeStorage.isAvailable().catch(() => false)) {
        try {
          const encrypted = await safeStorage.encrypt(json)
          payload = JSON.stringify({ _enc: true, data: encrypted } satisfies EncryptedPayload)
        }
        catch {
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

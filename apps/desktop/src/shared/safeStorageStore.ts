import type { z } from 'zod'
import type { DesktopEffect } from './lib/effect'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from './lib/effect'

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

const INVALID_JSON = Symbol('invalid-json')

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

  const safeStorageAvailableEffect = (): DesktopEffect<boolean> =>
    fromPromise(() => safeStorage.isAvailable()).pipe(Effect.catchAll(() => Effect.succeed(false)))

  const parseJsonEffect = (
    raw: string,
    onError: (error: unknown) => void,
  ): DesktopEffect<unknown | typeof INVALID_JSON> =>
    fromSync(() => JSON.parse(raw)).pipe(
      Effect.catchAll((err) =>
        fromSync(() => {
          onError(err)
          return INVALID_JSON
        }),
      ),
    )

  const decryptPayloadEffect = (payload: EncryptedPayload): DesktopEffect<unknown | typeof INVALID_JSON> =>
    Effect.gen(function* () {
      const decrypted = yield* fromPromise(() => safeStorage.decrypt(payload.data))
      return yield* parseJsonEffect(decrypted, (err) => warn('decrypt failed; treating session as invalid', err))
    }).pipe(
      Effect.catchAll((err) =>
        fromSync(() => {
          warn('decrypt failed; treating session as invalid', err)
          return INVALID_JSON
        }),
      ),
    )

  const encryptedPayloadEffect = (json: string): DesktopEffect<string> =>
    Effect.gen(function* () {
      const encrypted = yield* fromPromise(() => safeStorage.encrypt(json))
      return yield* fromSync(() => JSON.stringify({ _enc: true, data: encrypted } satisfies EncryptedPayload))
    }).pipe(
      Effect.catchAll((err) =>
        fromSync(() => {
          warn('encrypt failed; persisting plaintext fallback', err)
          return json
        }),
      ),
    )

  const readEffect = (): DesktopEffect<T | null> =>
    Effect.gen(function* () {
      const raw = yield* fromSync(() => localStorage.getItem(key))
      if (!raw) return null

      const parsed = yield* parseJsonEffect(raw, (err) => warn('failed to parse stored payload', err))
      if (parsed === INVALID_JSON) return null

      let candidate: unknown = parsed
      if (isEncryptedPayload(parsed) && (yield* safeStorageAvailableEffect())) {
        const decrypted = yield* decryptPayloadEffect(parsed)
        if (decrypted === INVALID_JSON) return null
        candidate = decrypted
      }

      const result = schema.safeParse(candidate)
      if (!result.success) {
        warn('stored payload failed schema validation; discarding')
        return null
      }
      return result.data
    })

  const writeEffect = (value: T): DesktopEffect<void> =>
    Effect.gen(function* () {
      const json = yield* fromSync(() => JSON.stringify(value))
      let payload = json

      if (yield* safeStorageAvailableEffect()) payload = yield* encryptedPayloadEffect(json)

      yield* fromSync(() => localStorage.setItem(key, payload))
    })

  const clearEffect = (): DesktopEffect<void> => fromSync(() => localStorage.removeItem(key))

  return {
    read: () => runDesktopEffect(readEffect()),
    write: (value) => runDesktopEffect(writeEffect(value)),
    clear: () => runDesktopSync(clearEffect()),
  }
}

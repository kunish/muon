import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { makeEncryptedStore } from '@/shared/safeStorageStore'

const sampleSchema = z.object({ token: z.string() })

interface FakeSafeStorage {
  isAvailable: () => Promise<boolean>
  encrypt: (s: string) => Promise<string>
  decrypt: (s: string) => Promise<string>
}

function makeFakeSafeStorage(available: boolean): FakeSafeStorage {
  return {
    isAvailable: vi.fn().mockResolvedValue(available),
    encrypt: vi.fn(async s => `ENC(${s})`),
    decrypt: vi.fn(async s => s.replace(/^ENC\((.*)\)$/, '$1')),
  }
}

describe('makeEncryptedStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('writes and reads with encryption when available', async () => {
    const safeStorage = makeFakeSafeStorage(true)
    const store = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage })

    await store.write({ token: 'abc' })
    const raw = localStorage.getItem('k')!
    expect(JSON.parse(raw)._enc).toBe(true)

    const read = await store.read()
    expect(read).toEqual({ token: 'abc' })
  })

  it('writes and reads plaintext when safeStorage unavailable', async () => {
    const safeStorage = makeFakeSafeStorage(false)
    const store = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage })

    await store.write({ token: 'abc' })
    const raw = localStorage.getItem('k')!
    expect(JSON.parse(raw)).toEqual({ token: 'abc' })

    const read = await store.read()
    expect(read).toEqual({ token: 'abc' })
  })

  it('returns null on missing key', async () => {
    const store = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage: makeFakeSafeStorage(false) })
    expect(await store.read()).toBeNull()
  })

  it('returns null on schema mismatch', async () => {
    const store = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage: makeFakeSafeStorage(false) })
    localStorage.setItem('k', JSON.stringify({ wrong: 'shape' }))
    expect(await store.read()).toBeNull()
  })

  it('clear removes the key', async () => {
    const store = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage: makeFakeSafeStorage(false) })
    await store.write({ token: 'abc' })
    store.clear()
    expect(localStorage.getItem('k')).toBeNull()
  })

  it('falls back to plaintext when encrypt throws', async () => {
    const safeStorage = makeFakeSafeStorage(true)
    safeStorage.encrypt = vi.fn().mockRejectedValueOnce(new Error('keychain locked'))
    const store = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage })

    await store.write({ token: 'abc' })
    const raw = localStorage.getItem('k')!
    expect(JSON.parse(raw)).toEqual({ token: 'abc' })
  })

  it('returns null when stored payload is encrypted but safeStorage is unavailable at read time', async () => {
    const writeSide = makeFakeSafeStorage(true)
    const readSide = makeFakeSafeStorage(false)

    const writer = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage: writeSide })
    await writer.write({ token: 'abc' })

    const reader = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage: readSide })
    expect(await reader.read()).toBeNull()
  })

  it('reads back an encrypted payload written by a separate store instance with the same key', async () => {
    const safeStorage = makeFakeSafeStorage(true)
    const writer = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage })
    await writer.write({ token: 'roundtrip' })

    const reader = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage })
    expect(await reader.read()).toEqual({ token: 'roundtrip' })
  })

  it('returns null when decrypt throws', async () => {
    const safeStorage = makeFakeSafeStorage(true)
    // Write first with working encrypt
    const writer = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage })
    await writer.write({ token: 'abc' })

    // Reader hits a decrypt failure
    safeStorage.decrypt = vi.fn().mockRejectedValueOnce(new Error('decrypt failed'))
    const reader = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage })
    expect(await reader.read()).toBeNull()
  })

  it('uses a custom logger when provided', async () => {
    const log = vi.fn()
    const safeStorage = makeFakeSafeStorage(true)
    safeStorage.encrypt = vi.fn().mockRejectedValueOnce(new Error('boom'))

    const store = makeEncryptedStore({ key: 'k', schema: sampleSchema, safeStorage, logger: log })
    await store.write({ token: 'abc' })

    expect(log).toHaveBeenCalled()
    expect(log.mock.calls[0]![0]).toContain('encrypt failed')
  })
})

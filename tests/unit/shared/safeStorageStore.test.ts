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
})

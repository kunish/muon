import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.unmock('@matrix/client')

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  tauriFetch: vi.fn(),
}))

vi.mock('matrix-js-sdk', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: mocks.tauriFetch,
}))

function setTauriInternals(value: { invoke?: unknown } | undefined): void {
  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    configurable: true,
    value,
  })
}

describe('matrix client', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    setTauriInternals(undefined)
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: originalFetch,
      writable: true,
    })
    setTauriInternals(undefined)
  })

  it('uses browser fetch in Vite web runtime without Tauri internals', async () => {
    const response = new Response('ok')
    const browserFetch = vi.fn().mockResolvedValue(response)
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: browserFetch,
      writable: true,
    })

    const { matrixFetch } = await import('@/matrix/client')

    await expect(matrixFetch('http://127.0.0.1:6167/_matrix/client/versions')).resolves.toBe(response)
    expect(browserFetch).toHaveBeenCalledWith('http://127.0.0.1:6167/_matrix/client/versions', undefined)
    expect(mocks.tauriFetch).not.toHaveBeenCalled()
  })

  it('keeps using the Tauri HTTP plugin when Tauri internals are available', async () => {
    const response = new Response('ok')
    const browserFetch = vi.fn()
    mocks.tauriFetch.mockResolvedValue(response)
    setTauriInternals({ invoke: vi.fn() })
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: browserFetch,
      writable: true,
    })

    const { matrixFetch } = await import('@/matrix/client')

    await expect(matrixFetch('http://127.0.0.1:6167/_matrix/client/versions')).resolves.toBe(response)
    expect(mocks.tauriFetch).toHaveBeenCalledWith('http://127.0.0.1:6167/_matrix/client/versions', undefined)
    expect(browserFetch).not.toHaveBeenCalled()
  })

  it('passes the runtime-aware fetch function into matrix-js-sdk', async () => {
    const { createClient, matrixFetch } = await import('@/matrix/client')

    createClient({
      serverUrl: 'http://127.0.0.1:6167',
      accessToken: 'mock_token',
      userId: '@kunish:localhost',
      deviceId: 'MOCK_DEVICE',
    })

    expect(mocks.createClient).toHaveBeenCalledWith(expect.objectContaining({
      fetchFn: matrixFetch,
    }))
  })
})

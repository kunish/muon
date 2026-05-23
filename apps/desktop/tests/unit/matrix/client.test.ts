import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.unmock('@matrix/client')

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  desktopFetch: vi.fn(),
}))

vi.mock('matrix-js-sdk', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@/desktop/http', () => ({
  fetch: mocks.desktopFetch,
}))

describe('matrix client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates Matrix network requests to the desktop-aware fetch adapter', async () => {
    const response = new Response('ok')
    mocks.desktopFetch.mockResolvedValue(response)

    const { matrixFetch } = await import('@/matrix/client')

    await expect(matrixFetch('http://127.0.0.1:6167/_matrix/client/versions')).resolves.toBe(response)
    expect(mocks.desktopFetch).toHaveBeenCalledWith('http://127.0.0.1:6167/_matrix/client/versions', undefined)
  })

  it('passes the runtime-aware fetch function into matrix-js-sdk', async () => {
    const { createClient, matrixFetch } = await import('@/matrix/client')
    const { matrixClientLogger } = await import('@/matrix/logger')

    createClient({
      serverUrl: 'http://127.0.0.1:6167',
      accessToken: 'mock_token',
      userId: '@kunish:localhost',
      deviceId: 'MOCK_DEVICE',
    })

    expect(mocks.createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        fetchFn: matrixFetch,
        logger: matrixClientLogger,
      }),
    )
  })
})

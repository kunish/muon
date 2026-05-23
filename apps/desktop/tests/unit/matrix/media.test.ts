import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.unmock('@/matrix/client')

const mocks = vi.hoisted(() => ({
  desktopFetch: vi.fn(),
  getAccessToken: vi.fn(() => 'token-1'),
  mxcUrlToHttp: vi.fn(() => 'http://legacy.example/download/server/media'),
}))

vi.mock('@/desktop/http', () => ({
  fetch: mocks.desktopFetch,
}))

vi.mock('@/matrix/client', () => ({
  getClient: vi.fn(() => ({
    baseUrl: 'http://matrix.example',
    getAccessToken: mocks.getAccessToken,
    mxcUrlToHttp: mocks.mxcUrlToHttp,
  })),
}))

describe('matrix media', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('downloads mxc media through authenticated Matrix media endpoints', async () => {
    mocks.desktopFetch
      .mockResolvedValueOnce(new Response('{"errcode":"M_UNAUTHORIZED"}', { status: 401 }))
      .mockResolvedValueOnce(new Response('png-bytes', { status: 200, headers: { 'content-type': 'image/png' } }))

    const { downloadMedia } = await import('@/matrix/media')
    const blob = await downloadMedia('mxc://server/media')

    expect(blob.type).toBe('image/png')
    expect(await blob.text()).toBe('png-bytes')
    expect(mocks.desktopFetch).toHaveBeenNthCalledWith(
      1,
      'http://matrix.example/_matrix/client/v1/media/download/server/media',
      { headers: { Authorization: 'Bearer token-1' } },
    )
    expect(mocks.desktopFetch).toHaveBeenNthCalledWith(
      2,
      'http://matrix.example/_matrix/media/v3/download/server/media',
      { headers: { Authorization: 'Bearer token-1' } },
    )
  })
})

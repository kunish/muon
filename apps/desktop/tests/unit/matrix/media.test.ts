import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.unmock('@/matrix/client')

const mocks = vi.hoisted(() => ({
  cacheMedia: vi.fn(() => Promise.resolve()),
  desktopFetch: vi.fn(),
  encodeBlurhash: vi.fn(() => 'encoded-blurhash'),
  getAccessToken: vi.fn(() => 'token-1'),
  getCachedMedia: vi.fn(() => Promise.resolve(null as Blob | null)),
  mxcUrlToHttp: vi.fn(() => 'http://legacy.example/download/server/media'),
  uploadContent: vi.fn(),
}))

vi.mock('blurhash', async () => {
  const actual = await vi.importActual<typeof import('blurhash')>('blurhash')
  return {
    ...actual,
    encode: mocks.encodeBlurhash,
  }
})

vi.mock('@/desktop/http', () => ({
  fetch: mocks.desktopFetch,
}))

vi.mock('@/features/chat/lib/mediaCache', () => ({
  cacheMedia: mocks.cacheMedia,
  getCachedMedia: mocks.getCachedMedia,
}))

vi.mock('@/matrix/client', () => ({
  getClient: vi.fn(() => ({
    baseUrl: 'http://matrix.example',
    getAccessToken: mocks.getAccessToken,
    mxcUrlToHttp: mocks.mxcUrlToHttp,
    uploadContent: mocks.uploadContent,
  })),
}))

describe('matrix media', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('uploads media through the configured Muon media endpoint', async () => {
    vi.stubEnv('VITE_MUON_MEDIA_UPLOAD_URL', 'http://127.0.0.1:8787/api/media/upload')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: 'https://s3.kunish.eu.org/muon-media/media/avatar.png' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const { uploadMedia } = await import('@/matrix/media')
    const file = new File(['avatar-bytes'], 'avatar.png', { type: 'image/png' })

    await expect(uploadMedia(file)).resolves.toBe('https://s3.kunish.eu.org/muon-media/media/avatar.png')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8787/api/media/upload',
      expect.objectContaining({
        body: file,
        headers: {
          'content-type': 'image/png',
          'x-muon-file-name': 'avatar.png',
        },
        method: 'POST',
      }),
    )
    expect(mocks.uploadContent).not.toHaveBeenCalled()
    expect(mocks.cacheMedia).toHaveBeenCalledWith('https://s3.kunish.eu.org/muon-media/media/avatar.png', file)
  })

  it('keeps an instant blob URL for uploaded Muon media', async () => {
    vi.stubEnv('VITE_MUON_MEDIA_UPLOAD_URL', 'http://127.0.0.1:8787/api/media/upload')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: 'https://s3.kunish.eu.org/muon-media/media/avatar.png' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const createObjectUrl = vi.fn(() => 'blob:uploaded-avatar')
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    })

    const { getInstantMediaBlobUrl, uploadMedia } = await import('@/matrix/media')
    const file = new File(['avatar-bytes'], 'avatar.png', { type: 'image/png' })

    await expect(uploadMedia(file)).resolves.toBe('https://s3.kunish.eu.org/muon-media/media/avatar.png')
    expect(getInstantMediaBlobUrl('https://s3.kunish.eu.org/muon-media/media/avatar.png')).toBe('blob:uploaded-avatar')
    expect(getInstantMediaBlobUrl('https://s3.kunish.eu.org/muon-media/media/avatar.png', 300, 300)).toBe(
      'blob:uploaded-avatar',
    )
    expect(createObjectUrl).toHaveBeenCalledWith(file)
  })

  it('persists uploaded blob media under the final Muon media URL', async () => {
    vi.stubEnv('VITE_MUON_MEDIA_UPLOAD_URL', 'http://127.0.0.1:8787/api/media/upload')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: 'https://s3.kunish.eu.org/muon-media/media/voice.ogg' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    )

    const { uploadMedia } = await import('@/matrix/media')
    const blob = new Blob(['voice-bytes'], { type: 'audio/ogg' })

    await expect(uploadMedia(blob)).resolves.toBe('https://s3.kunish.eu.org/muon-media/media/voice.ogg')
    expect(mocks.cacheMedia).toHaveBeenCalledWith('https://s3.kunish.eu.org/muon-media/media/voice.ogg', blob)
  })

  it('extracts image metadata with a blurhash from downsampled pixels', async () => {
    const originalImage = globalThis.Image
    const drawImage = vi.fn()
    const pixelData = new Uint8ClampedArray(32 * 18 * 4)
    const getImageData = vi.fn(() => ({
      data: pixelData,
      height: 18,
      width: 32,
    }))
    const canvas = {
      getContext: vi.fn(() => ({
        drawImage,
        getImageData,
      })),
      height: 0,
      width: 0,
    } as unknown as HTMLCanvasElement
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (tagName === 'canvas') return canvas
      return originalCreateElement(tagName, options)
    }) as typeof document.createElement)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:image')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    class MockImage {
      naturalHeight = 360
      naturalWidth = 640
      onerror: (() => void) | null = null
      onload: (() => void) | null = null

      get src(): string {
        return ''
      }

      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    }
    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      value: MockImage,
    })

    try {
      const { extractImageMeta } = await import('@/matrix/media')
      const file = new File(['image'], 'photo.png', { type: 'image/png' })

      await expect(extractImageMeta(file)).resolves.toEqual({
        blurhash: 'encoded-blurhash',
        height: 360,
        width: 640,
      })
      expect(canvas.width).toBe(32)
      expect(canvas.height).toBe(18)
      expect(drawImage).toHaveBeenCalledWith(expect.any(MockImage), 0, 0, 32, 18)
      expect(getImageData).toHaveBeenCalledWith(0, 0, 32, 18)
      expect(mocks.encodeBlurhash).toHaveBeenCalledWith(pixelData, 32, 18, 4, 3)
    } finally {
      Object.defineProperty(globalThis, 'Image', {
        configurable: true,
        value: originalImage,
      })
    }
  })

  it('falls back to Matrix media upload when no Muon media endpoint is configured', async () => {
    mocks.uploadContent.mockResolvedValueOnce({ content_uri: 'mxc://localhost/fallback' })

    const { uploadMedia } = await import('@/matrix/media')
    const file = new File(['plain'], 'note.txt', { type: 'text/plain' })

    await expect(uploadMedia(file)).resolves.toBe('mxc://localhost/fallback')
    expect(mocks.uploadContent).toHaveBeenCalledWith(file, { type: 'text/plain' })
    expect(mocks.cacheMedia).not.toHaveBeenCalled()
  })

  it('falls back to Matrix media upload when the configured Muon media endpoint is unavailable', async () => {
    vi.stubEnv('VITE_MUON_MEDIA_UPLOAD_URL', 'http://127.0.0.1:8787/api/media/upload')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Media storage is not configured' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    )
    mocks.uploadContent.mockResolvedValueOnce({ content_uri: 'mxc://localhost/fallback-after-503' })

    const { uploadMedia } = await import('@/matrix/media')
    const file = new File(['plain'], 'note.txt', { type: 'text/plain' })

    await expect(uploadMedia(file)).resolves.toBe('mxc://localhost/fallback-after-503')
    expect(mocks.uploadContent).toHaveBeenCalledWith(file, { type: 'text/plain' })
    expect(mocks.cacheMedia).not.toHaveBeenCalled()
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

  it('downloads http media URLs through the desktop fetch bridge', async () => {
    mocks.desktopFetch.mockResolvedValueOnce(
      new Response('s3-bytes', { status: 200, headers: { 'content-type': 'image/png' } }),
    )

    const { downloadMedia } = await import('@/matrix/media')
    const blob = await downloadMedia('https://s3.kunish.eu.org/muon-media/media/photo.png')

    expect(blob.type).toBe('image/png')
    expect(await blob.text()).toBe('s3-bytes')
    expect(mocks.desktopFetch).toHaveBeenCalledWith('https://s3.kunish.eu.org/muon-media/media/photo.png', {
      headers: {},
    })
  })

  it('uses the original http media cache when a thumbnail-sized request misses', async () => {
    const cachedBlob = new Blob(['cached-s3-bytes'], { type: 'image/png' })
    mocks.getCachedMedia.mockResolvedValueOnce(null).mockResolvedValueOnce(cachedBlob)
    const createObjectUrl = vi.fn(() => 'blob:cached-s3-media')
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    })

    const { fetchMediaBlobUrl } = await import('@/matrix/media')

    await expect(fetchMediaBlobUrl('https://s3.kunish.eu.org/muon-media/media/photo.png', 300, 300)).resolves.toBe(
      'blob:cached-s3-media',
    )
    expect(mocks.getCachedMedia).toHaveBeenNthCalledWith(
      1,
      'https://s3.kunish.eu.org/muon-media/media/photo.png',
      300,
      300,
    )
    expect(mocks.getCachedMedia).toHaveBeenNthCalledWith(2, 'https://s3.kunish.eu.org/muon-media/media/photo.png')
    expect(createObjectUrl).toHaveBeenCalledWith(cachedBlob)
    expect(mocks.desktopFetch).not.toHaveBeenCalled()
  })

  it('returns an instant uploaded blob URL before async cache lookups', async () => {
    vi.stubEnv('VITE_MUON_MEDIA_UPLOAD_URL', 'http://127.0.0.1:8787/api/media/upload')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: 'https://s3.kunish.eu.org/muon-media/media/avatar.png' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    )
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:uploaded-avatar'),
    })

    const { fetchMediaBlobUrl, uploadMedia } = await import('@/matrix/media')
    const file = new File(['avatar-bytes'], 'avatar.png', { type: 'image/png' })

    await uploadMedia(file)

    await expect(fetchMediaBlobUrl('https://s3.kunish.eu.org/muon-media/media/avatar.png', 300, 300)).resolves.toBe(
      'blob:uploaded-avatar',
    )
    expect(mocks.getCachedMedia).not.toHaveBeenCalled()
    expect(mocks.desktopFetch).not.toHaveBeenCalled()
  })
})

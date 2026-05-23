import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchMock, openUrlMock, toastErrorMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  openUrlMock: vi.fn(),
  toastErrorMock: vi.fn(),
}))

vi.mock('@/desktop/http', () => ({
  fetch: fetchMock,
}))

vi.mock('@/desktop/opener', () => ({
  openUrl: openUrlMock,
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: toastErrorMock,
  },
}))

describe('link preview layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (!(globalThis as any).__ogCache) {
      ;(globalThis as any).__ogCache = new Map()
    }
    ;(globalThis as any).__ogCache.clear()
    if (!(globalThis as any).__ogInflight) {
      ;(globalThis as any).__ogInflight = new Map()
    }
    ;(globalThis as any).__ogInflight.clear()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValueOnce('blob:favicon').mockReturnValueOnce('blob:og-image'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
  })

  it('keeps the same reserved slots after metadata loads without an image or description', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        `
        <html>
          <head>
            <title>Muon release notes</title>
            <link rel="icon" href="/favicon.ico">
          </head>
        </html>
      `,
        { headers: { 'content-type': 'text/html' } },
      ),
    )

    const LinkPreview = (await import('@/features/chat/components/LinkPreview.vue')).default
    const wrapper = mount(LinkPreview, {
      props: {
        url: 'https://example.com/release',
      },
    })

    expect(wrapper.find('[data-testid="link-preview-description-slot"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="link-preview-media-slot"]').exists()).toBe(true)

    await flushPromises()

    const descriptionSlot = wrapper.get('[data-testid="link-preview-description-slot"]')
    const mediaSlot = wrapper.get('[data-testid="link-preview-media-slot"]')
    expect(descriptionSlot.classes()).toContain('min-h-[38px]')
    expect(mediaSlot.classes()).toContain('h-[92px]')
    expect(mediaSlot.classes()).toContain('w-[124px]')

    wrapper.unmount()
  })

  it('renders Open Graph metadata, favicon, and preview image from public asset URLs', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === 'https://example.com/release') {
        return new Response(
          `
        <html>
          <head>
            <title>Fallback title</title>
            <meta property="og:title" content="OG release notes">
            <meta property="og:description" content="Open Graph description">
            <meta property="og:image" content="/og/release.png">
            <link rel="icon" href="/favicon.ico">
          </head>
        </html>
      `,
          { headers: { 'content-type': 'text/html' } },
        )
      }

      if (url === 'https://example.com/favicon.ico') {
        return new Response('ico', { headers: { 'content-type': 'image/x-icon' } })
      }

      if (url === 'https://example.com/og/release.png') {
        return new Response('png', { headers: { 'content-type': 'image/png' } })
      }

      throw new Error(`unexpected URL ${url}`)
    })

    const LinkPreview = (await import('@/features/chat/components/LinkPreview.vue')).default
    const wrapper = mount(LinkPreview, {
      props: {
        url: 'https://example.com/release',
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('OG release notes')
    })

    expect(wrapper.text()).toContain('OG release notes')
    expect(wrapper.text()).toContain('Open Graph description')

    await vi.waitFor(() => {
      expect(wrapper.findAll('img')).toHaveLength(2)
    })

    const images = wrapper.findAll('img')
    expect(images[0].attributes('src')).toBe('blob:favicon')
    expect(images[1].attributes('src')).toBe('blob:og-image')
    expect(images[1].classes()).toContain('object-contain')
    expect(images[1].classes()).not.toContain('object-cover')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/favicon.ico',
      expect.objectContaining({
        headers: expect.objectContaining({ accept: 'image/*,*/*;q=0.8' }),
        redirect: 'follow',
      }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/og/release.png',
      expect.objectContaining({
        headers: expect.objectContaining({ accept: 'image/*,*/*;q=0.8' }),
        redirect: 'follow',
      }),
    )

    wrapper.unmount()
  })

  it('ignores stale cached entries from older preview parsing rules', async () => {
    ;(globalThis as any).__ogCache.set('https://x.com', {
      description: '',
      favicon: 'https://abs.twimg.com/favicons/twitter.3.ico',
      ogImage: '',
      title: 'X (formerly Twitter)',
    })
    fetchMock.mockImplementation(async (url: string) => {
      if (url === 'https://x.com/') {
        return new Response(
          `
        <html>
          <head>
            <meta property="og:title" content="X. It's what's happening">
            <meta property="og:description" content="From breaking news and entertainment to sports and politics, get the full story.">
            <meta property="og:image" content="https://abs.twimg.com/rweb/ssr/default/v2/og/image.png">
            <link rel="shortcut icon" href="//abs.twimg.com/favicons/twitter.3.ico">
          </head>
        </html>
      `,
          { headers: { 'content-type': 'text/html' } },
        )
      }

      if (url === 'https://abs.twimg.com/favicons/twitter.3.ico') {
        return new Response('ico', { headers: { 'content-type': 'image/x-icon' } })
      }

      if (url === 'https://abs.twimg.com/rweb/ssr/default/v2/og/image.png') {
        return new Response('png', { headers: { 'content-type': 'image/png' } })
      }

      throw new Error(`unexpected URL ${url}`)
    })

    const LinkPreview = (await import('@/features/chat/components/LinkPreview.vue')).default
    const wrapper = mount(LinkPreview, {
      props: {
        url: 'https://x.com',
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("X. It's what's happening")
    })
    expect(fetchMock).toHaveBeenCalledWith('https://x.com/', expect.anything())

    wrapper.unmount()
  })

  it('uses a link-expanding crawler user agent so X returns complete Open Graph metadata', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const userAgent = (init?.headers as Record<string, string> | undefined)?.['user-agent'] ?? ''
      if (url === 'https://x.com/') {
        if (!userAgent.includes('Slackbot-LinkExpanding')) {
          return new Response(
            `
          <html>
            <head>
              <meta property="og:site_name" content="X (formerly Twitter)">
              <link rel="shortcut icon" href="//abs.twimg.com/favicons/twitter.3.ico">
            </head>
          </html>
        `,
            { headers: { 'content-type': 'text/html' } },
          )
        }

        return new Response(
          `
        <html>
          <head>
            <meta property="og:site_name" content="X (formerly Twitter)">
            <meta property="og:title" content="X. It's what's happening">
            <meta property="og:description" content="From breaking news and entertainment to sports and politics, get the full story.">
            <meta property="og:image" content="https://abs.twimg.com/rweb/ssr/default/v2/og/image.png">
            <link rel="shortcut icon" href="//abs.twimg.com/favicons/twitter.3.ico">
          </head>
        </html>
      `,
          { headers: { 'content-type': 'text/html' } },
        )
      }

      if (url === 'https://abs.twimg.com/favicons/twitter.3.ico') {
        return new Response('ico', { headers: { 'content-type': 'image/x-icon' } })
      }

      if (url === 'https://abs.twimg.com/rweb/ssr/default/v2/og/image.png') {
        return new Response('png', { headers: { 'content-type': 'image/png' } })
      }

      throw new Error(`unexpected URL ${url}`)
    })

    const LinkPreview = (await import('@/features/chat/components/LinkPreview.vue')).default
    const wrapper = mount(LinkPreview, {
      props: {
        url: 'https://x.com',
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("X. It's what's happening")
    })
    expect(wrapper.text()).toContain('From breaking news and entertainment to sports and politics')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://x.com/',
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: 'text/html,application/xhtml+xml',
          'accept-language': expect.any(String),
          'user-agent': expect.stringContaining('Slackbot-LinkExpanding'),
        }),
        redirect: 'manual',
      }),
    )

    await vi.waitFor(() => {
      expect(wrapper.findAll('img')).toHaveLength(2)
    })
    expect(wrapper.findAll('img')[0].attributes('src')).toBe('blob:favicon')
    expect(wrapper.findAll('img')[1].attributes('src')).toBe('blob:og-image')

    wrapper.unmount()
  })

  it('retries with a browser user agent when a site returns an empty crawler preview page', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const userAgent = (init?.headers as Record<string, string> | undefined)?.['user-agent'] ?? ''
      if (url === 'https://www.baidu.com/') {
        if (userAgent.includes('Slackbot-LinkExpanding')) {
          return new Response(
            `
          <html>
            <head>
              <script>location.replace(location.href.replace("https://","http://"));</script>
            </head>
            <body>
              <noscript><meta http-equiv="refresh" content="0;url=http://www.baidu.com/"></noscript>
            </body>
          </html>
        `,
            { headers: { 'content-type': 'text/html' } },
          )
        }

        return new Response(
          `
        <html>
          <head>
            <meta name="description" content="全球领先的中文搜索引擎、致力于让网民更便捷地获取信息，找到所求。">
            <link rel="shortcut icon" href="https://www.baidu.com/favicon.ico" type="image/x-icon">
            <title>百度一下，你就知道</title>
          </head>
        </html>
      `,
          { headers: { 'content-type': 'text/html; charset=utf-8' } },
        )
      }

      if (url === 'https://www.baidu.com/favicon.ico') {
        return new Response('ico', { headers: { 'content-type': 'image/x-icon' } })
      }

      throw new Error(`unexpected URL ${url}`)
    })

    const LinkPreview = (await import('@/features/chat/components/LinkPreview.vue')).default
    const wrapper = mount(LinkPreview, {
      props: {
        url: 'https://www.baidu.com',
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('百度一下，你就知道')
    })
    expect(wrapper.text()).toContain('全球领先的中文搜索引擎')
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://www.baidu.com/',
      expect.objectContaining({
        headers: expect.objectContaining({
          'user-agent': expect.stringContaining('Slackbot-LinkExpanding'),
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://www.baidu.com/',
      expect.objectContaining({
        headers: expect.objectContaining({
          'user-agent': expect.stringContaining('Mozilla/5.0'),
        }),
      }),
    )

    wrapper.unmount()
  })

  it('uses the same crawler user agent for IMDb title pages that gate browser-like preview requests', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const userAgent = (init?.headers as Record<string, string> | undefined)?.['user-agent'] ?? ''
      if (url === 'https://www.imdb.com/title/tt0117500') {
        if (!userAgent.includes('Slackbot-LinkExpanding')) {
          return new Response(
            `
          <html>
            <head><title></title></head>
            <body><h1>JavaScript is disabled</h1>In order to continue, we need to verify that you're not a robot.</body>
          </html>
        `,
            { headers: { 'content-type': 'text/html' } },
          )
        }

        return new Response(
          `
        <html>
          <head>
            <title>The Rock (1996) - IMDb</title>
            <meta property="og:title" content="The Rock (1996) ⭐ 7.4 | Action, Adventure, Thriller">
            <meta property="og:description" content="2h 16m | R">
            <meta property="og:image" content="https://m.media-amazon.com/images/M/the-rock.jpg">
            <link rel="icon" sizes="32x32" href="https://m.media-amazon.com/images/G/imdb-favicon.png">
          </head>
        </html>
      `,
          { headers: { 'content-type': 'text/html' } },
        )
      }

      if (url === 'https://m.media-amazon.com/images/G/imdb-favicon.png') {
        return new Response('png', { headers: { 'content-type': 'image/png' } })
      }

      if (url === 'https://m.media-amazon.com/images/M/the-rock.jpg') {
        return new Response('jpg', { headers: { 'content-type': 'image/jpeg' } })
      }

      throw new Error(`unexpected URL ${url}`)
    })

    const LinkPreview = (await import('@/features/chat/components/LinkPreview.vue')).default
    const wrapper = mount(LinkPreview, {
      props: {
        url: 'https://www.imdb.com/title/tt0117500',
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('The Rock (1996) ⭐ 7.4')
    })
    expect(wrapper.text()).toContain('2h 16m | R')

    await vi.waitFor(() => {
      expect(wrapper.findAll('img')).toHaveLength(2)
    })
    expect(wrapper.findAll('img')[0].attributes('src')).toBe('blob:favicon')
    expect(wrapper.findAll('img')[1].attributes('src')).toBe('blob:og-image')

    wrapper.unmount()
  })
})

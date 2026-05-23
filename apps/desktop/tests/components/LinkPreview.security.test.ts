import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetch } from '@/desktop/http'
import LinkPreview from '@/features/chat/components/LinkPreview.vue'

vi.mock('@/desktop/http', () => ({
  fetch: vi.fn(),
}))

vi.mock('@/desktop/opener', () => ({
  openUrl: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('vue-sonner', () => ({
  toast: { error: vi.fn() },
}))

describe('linkPreview security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as any).__ogCache?.clear()
    ;(globalThis as any).__ogInflight?.clear()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValueOnce('blob:favicon').mockReturnValueOnce('blob:preview'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
  })

  it('fetches preview HTML with redirects disabled', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('<html><title>Safe</title></html>', {
        headers: { 'content-type': 'text/html' },
      }),
    )

    mount(LinkPreview, {
      props: { url: 'https://example.com/post' },
    })

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalled()
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/post',
      expect.objectContaining({
        redirect: 'manual',
      }),
    )
  })

  it('follows public redirects before parsing preview HTML', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response('', {
          status: 302,
          headers: { location: 'https://example.com/final' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('<html><title>Final title</title></html>', {
          headers: { 'content-type': 'text/html' },
        }),
      )

    const wrapper = mount(LinkPreview, {
      props: { url: 'https://example.com/post' },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Final title')
    })

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://example.com/post',
      expect.objectContaining({
        redirect: 'manual',
      }),
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://example.com/final',
      expect.objectContaining({
        redirect: 'manual',
      }),
    )
  })

  it('renders public preview image assets from parsed HTML', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          `
      <html>
        <head>
          <title>Safe title</title>
          <meta name="description" content="Safe description">
          <meta property="og:image" content="https://cdn.example.com/preview.png">
          <link rel="icon" href="https://cdn.example.com/favicon.ico">
        </head>
      </html>
    `,
          {
            headers: { 'content-type': 'text/html' },
          },
        ),
      )
      .mockResolvedValueOnce(new Response('ico', { headers: { 'content-type': 'image/x-icon' } }))
      .mockResolvedValueOnce(new Response('png', { headers: { 'content-type': 'image/png' } }))

    const wrapper = mount(LinkPreview, {
      props: { url: 'https://example.com/post-with-assets' },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Safe title')
    })

    expect(wrapper.text()).toContain('Safe description')
    expect(wrapper.text()).toContain('example.com')
    await vi.waitFor(() => {
      expect(wrapper.findAll('img')).toHaveLength(2)
    })

    const images = wrapper.findAll('img')
    expect(images[0].attributes('src')).toBe('blob:favicon')
    expect(images[1].attributes('src')).toBe('blob:preview')
  })

  it('does not render unsafe preview image assets from parsed HTML', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        `
      <html>
        <head>
          <title>Safe title</title>
          <meta property="og:image" content="http://169.254.169.254/preview.png">
          <link rel="icon" href="file:///etc/passwd">
        </head>
      </html>
    `,
        {
          headers: { 'content-type': 'text/html' },
        },
      ),
    )

    const wrapper = mount(LinkPreview, {
      props: { url: 'https://example.com/post-with-unsafe-assets' },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Safe title')
    })

    expect(wrapper.findAll('img')).toHaveLength(0)
    expect(wrapper.html()).not.toContain('169.254.169.254')
    expect(wrapper.html()).not.toContain('file:///etc/passwd')
  })
})

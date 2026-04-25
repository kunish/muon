import { fetch } from '@tauri-apps/plugin-http'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LinkPreview from '@/features/chat/components/LinkPreview.vue'

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-opener', () => ({
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
  })

  it('fetches preview HTML with redirects disabled', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('<html><title>Safe</title></html>', {
      headers: { 'content-type': 'text/html' },
    }))

    mount(LinkPreview, {
      props: { url: 'https://example.com/post' },
    })

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalled()
    })

    expect(fetch).toHaveBeenCalledWith('https://example.com/post', expect.objectContaining({
      redirect: 'manual',
    }))
  })

  it('does not render remote preview image assets from parsed HTML', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(`
      <html>
        <head>
          <title>Safe title</title>
          <meta name="description" content="Safe description">
          <meta property="og:image" content="https://cdn.example.com/preview.png">
          <link rel="icon" href="https://cdn.example.com/favicon.ico">
        </head>
      </html>
    `, {
      headers: { 'content-type': 'text/html' },
    }))

    const wrapper = mount(LinkPreview, {
      props: { url: 'https://example.com/post-with-assets' },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Safe title')
    })

    expect(wrapper.text()).toContain('Safe description')
    expect(wrapper.text()).toContain('example.com')
    expect(wrapper.findAll('img')).toHaveLength(0)
    expect(wrapper.html()).not.toContain('https://cdn.example.com/preview.png')
    expect(wrapper.html()).not.toContain('https://cdn.example.com/favicon.ico')
  })
})

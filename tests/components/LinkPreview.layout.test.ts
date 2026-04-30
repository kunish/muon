import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchMock, openUrlMock, toastErrorMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  openUrlMock: vi.fn(),
  toastErrorMock: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: fetchMock,
}))

vi.mock('@tauri-apps/plugin-opener', () => ({
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
    ;(globalThis as any).__ogCache = new Map()
    ;(globalThis as any).__ogInflight = new Map()
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
    expect(descriptionSlot.classes()).toContain('min-h-[34px]')
    expect(mediaSlot.classes()).toContain('h-[60px]')
    expect(mediaSlot.classes()).toContain('w-[60px]')

    wrapper.unmount()
  })
})

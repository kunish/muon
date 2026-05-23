import { describe, expect, it, vi } from 'vitest'
import { copyMessageContentToClipboard, createMessageClipboardPayload } from '@/features/chat/lib/messageClipboard'

describe('message clipboard', () => {
  it('keeps rich media html while removing fallback placeholders from copied plain text', () => {
    const payload = createMessageClipboardPayload({
      msgtype: 'm.text',
      body: 'Caption\n[image.png]',
      format: 'org.matrix.custom.html',
      formatted_body:
        '<p><strong>Caption</strong></p><p><img src="mxc://server/media" alt="image.png" title="image.png"></p>',
    })

    expect(payload.text).toBe('Caption')
    expect(payload.html).toContain('<strong>Caption</strong>')
    expect(payload.html).not.toContain('[image.png]')
    expect(payload.html).toContain('<img')
    expect(payload.html).toContain('src="mxc://server/media"')
  })

  it('writes rich clipboard data when ClipboardItem is available', async () => {
    const write = vi.fn(async () => {})
    const writeText = vi.fn(async () => {})
    const OriginalClipboardItem = globalThis.ClipboardItem
    const clipboardItem = vi.fn()

    class MockClipboardItem {
      constructor(items: Record<string, Blob>) {
        clipboardItem(items)
      }
    }

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write, writeText },
    })
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      value: MockClipboardItem,
    })

    try {
      await copyMessageContentToClipboard({
        body: 'Caption\n[image.png]',
        format: 'org.matrix.custom.html',
        formatted_body: '<p>Caption</p><p><img src="mxc://server/media" alt="image.png"></p>',
      })

      expect(write).toHaveBeenCalledTimes(1)
      expect(writeText).not.toHaveBeenCalled()
      expect(clipboardItem).toHaveBeenCalledWith(
        expect.objectContaining({
          'text/html': expect.any(Blob),
          'text/plain': expect.any(Blob),
        }),
      )
    } finally {
      Object.defineProperty(globalThis, 'ClipboardItem', {
        configurable: true,
        value: OriginalClipboardItem,
      })
    }
  })
})

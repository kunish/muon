import { describe, expect, it, vi } from 'vitest'

import {
  getPreviewAssetUrl,
  getPreviewRequestUrl,
  isHtmlPreviewResponse,
  MAX_LINK_PREVIEW_BYTES,
  readLimitedText,
} from '@/features/chat/lib/linkPreview'

describe('link preview request hardening', () => {
  it('accepts public http and https URLs and strips credentials', () => {
    expect(getPreviewRequestUrl('http://example.com/path')?.href).toBe('http://example.com/path')
    expect(getPreviewRequestUrl('https://user:pass@example.com/path')?.href).toBe('https://example.com/path')
  })

  it('rejects unsupported protocols', () => {
    expect(getPreviewRequestUrl('file:///etc/passwd')).toBeNull()
    expect(getPreviewRequestUrl('ftp://example.com/file')).toBeNull()
    expect(getPreviewRequestUrl('mailto:test@example.com')).toBeNull()
  })

  it('rejects statically identifiable local, private, and metadata hosts', () => {
    const unsafeUrls = [
      'http://localhost',
      'http://app.localhost',
      'http://printer.local',
      'http://127.0.0.1',
      'http://0.0.0.0',
      'http://10.1.2.3',
      'http://169.254.169.254',
      'http://172.16.0.1',
      'http://172.31.255.255',
      'http://192.168.1.1',
      'http://[::]',
      'http://[::1]',
      'http://[::ffff:127.0.0.1]',
      'http://[::ffff:7f00:1]',
      'http://[::ffff:a00:1]',
      'http://[fe80::1]',
      'http://[fc00::1]',
      'http://[fd00::1]',
      'http://metadata.google.internal',
    ]

    for (const url of unsafeUrls) {
      expect(getPreviewRequestUrl(url), url).toBeNull()
    }
  })

  it('accepts HTML responses within the byte limit', async () => {
    const resp = new Response('<html><title>ok</title></html>', {
      headers: {
        'content-length': '29',
        'content-type': 'text/html; charset=utf-8',
      },
    })

    expect(MAX_LINK_PREVIEW_BYTES).toBe(2 * 1024 * 1024)
    expect(isHtmlPreviewResponse(resp)).toBe(true)
    await expect(readLimitedText(resp)).resolves.toBe('<html><title>ok</title></html>')
  })

  it('accepts modern landing pages whose metadata appears after the old 256KB cap', async () => {
    const html = `<html><head>${' '.repeat(256 * 1024 + 1)}<meta property="og:title" content="Late metadata"></head></html>`
    const resp = new Response(html, {
      headers: {
        'content-length': String(new TextEncoder().encode(html).byteLength),
        'content-type': 'text/html; charset=utf-8',
      },
    })

    expect(isHtmlPreviewResponse(resp)).toBe(true)
    await expect(readLimitedText(resp)).resolves.toBe(html)
  })

  it('rejects JSON and oversized responses', async () => {
    const jsonResp = new Response('{"ok":true}', {
      headers: { 'content-type': 'application/json' },
    })
    const oversizedHeaderResp = new Response('<html></html>', {
      headers: {
        'content-length': String(MAX_LINK_PREVIEW_BYTES + 1),
        'content-type': 'text/html',
      },
    })
    const oversizedBodyResp = new Response('a'.repeat(MAX_LINK_PREVIEW_BYTES + 1), {
      headers: { 'content-type': 'text/html' },
    })

    expect(isHtmlPreviewResponse(jsonResp)).toBe(false)
    expect(isHtmlPreviewResponse(oversizedHeaderResp)).toBe(false)
    await expect(readLimitedText(oversizedBodyResp)).resolves.toBeNull()
  })

  it('does not read no-stream responses', async () => {
    const makeResponse = (contentLength?: string) => {
      const text = vi.fn().mockResolvedValue('<html></html>')
      return {
        body: null,
        headers: new Headers(contentLength === undefined ? {} : { 'content-length': contentLength }),
        text,
      } as unknown as Response & { text: ReturnType<typeof vi.fn> }
    }

    const missingLength = makeResponse()
    const invalidLength = makeResponse('invalid')
    const oversizedLength = makeResponse(String(MAX_LINK_PREVIEW_BYTES + 1))
    const smallLength = makeResponse('13')

    await expect(readLimitedText(missingLength)).resolves.toBeNull()
    await expect(readLimitedText(invalidLength)).resolves.toBeNull()
    await expect(readLimitedText(oversizedLength)).resolves.toBeNull()
    await expect(readLimitedText(smallLength)).resolves.toBeNull()

    expect(missingLength.text).not.toHaveBeenCalled()
    expect(invalidLength.text).not.toHaveBeenCalled()
    expect(oversizedLength.text).not.toHaveBeenCalled()
    expect(smallLength.text).not.toHaveBeenCalled()
  })

  it('accepts public absolute and relative asset URLs', () => {
    expect(getPreviewAssetUrl('https://cdn.example.com/image.png', 'https://example.com/page')).toBe(
      'https://cdn.example.com/image.png',
    )
    expect(getPreviewAssetUrl('/assets/favicon.ico', 'https://example.com/posts/1')).toBe(
      'https://example.com/assets/favicon.ico',
    )
  })

  it('rejects private and unsupported asset URLs', () => {
    expect(getPreviewAssetUrl('http://169.254.169.254/latest/meta-data', 'https://example.com/page')).toBe('')
    expect(getPreviewAssetUrl('http://localhost/favicon.ico', 'https://example.com/page')).toBe('')
    expect(getPreviewAssetUrl('file:///etc/passwd', 'https://example.com/page')).toBe('')
  })
})

import type { DesktopEffect } from '@/shared/lib/effect'
import { htmlToPlainText, sanitizeMatrixHtml } from '@muon/rich-text'
import { Effect } from 'effect'
import { fromPromise, runDesktopEffect } from '@/shared/lib/effect'

export interface MessageClipboardPayload {
  text: string
  html?: string
}

const MATRIX_HTML_FORMAT = 'org.matrix.custom.html'
const MEDIA_PLACEHOLDER_LINE_RE =
  /^\s*\[[^\]\r\n]+\.(?:png|jpe?g|gif|webp|bmp|svg|avif|heic|mp4|mov|m4v|webm|mp3|wav|m4a|ogg|pdf|zip|docx?|xlsx?|pptx?)\]\s*$/i

export function createMessageClipboardPayload(content: unknown): MessageClipboardPayload {
  const body = getContentString(content, 'body')
  const html = getFormattedMessageHtml(content)
  if (!html) return { text: body }

  const textFromHtml = htmlToPlainText(html).trim()
  const text = textFromHtml || stripMediaPlaceholderLines(body)

  return {
    text,
    html: html || undefined,
  }
}

export function copyMessageContentToClipboard(content: unknown): Promise<void> {
  return runDesktopEffect(copyMessageContentToClipboardEffect(content))
}

export function copyMessageContentToClipboardEffect(content: unknown): DesktopEffect<void> {
  const payload = createMessageClipboardPayload(content)
  const clipboard = navigator.clipboard
  return Effect.gen(function* () {
    const html = payload.html
    if (html && clipboard?.write && typeof ClipboardItem !== 'undefined') {
      const richWriteSucceeded = yield* fromPromise(() =>
        clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([payload.text], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ]),
      ).pipe(
        Effect.as(true),
        Effect.catchAll(() => Effect.succeed(false)),
      )
      if (richWriteSucceeded) return
    }

    yield* fromPromise(() => clipboard.writeText(payload.text))
  })
}

function getFormattedMessageHtml(content: unknown): string {
  if (getContentString(content, 'format') !== MATRIX_HTML_FORMAT) return ''

  const html = getContentString(content, 'formatted_body')
  return html ? sanitizeMatrixHtml(html) : ''
}

function getContentString(content: unknown, key: string): string {
  if (!content || typeof content !== 'object') return ''

  const value = (content as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

function stripMediaPlaceholderLines(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !MEDIA_PLACEHOLDER_LINE_RE.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

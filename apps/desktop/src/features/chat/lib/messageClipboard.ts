import { htmlToPlainText, sanitizeMatrixHtml } from '@muon/rich-text'

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

export async function copyMessageContentToClipboard(content: unknown): Promise<void> {
  const payload = createMessageClipboardPayload(content)
  const clipboard = navigator.clipboard
  if (payload.html && clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      await clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([payload.text], { type: 'text/plain' }),
          'text/html': new Blob([payload.html], { type: 'text/html' }),
        }),
      ])
      return
    } catch {
      // Some Electron/browser contexts expose ClipboardItem but reject rich writes.
    }
  }

  await clipboard.writeText(payload.text)
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

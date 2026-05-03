import { marked } from 'marked'
import { sanitizeMatrixHtml } from './htmlSanitizer'

const INLINE_MARKDOWN_RE = /\*\*[^*\n]+\*\*|__[^_\n]+__|(?<!\*)\*[^*\n]+\*(?!\*)|_[^_\n]+_|~~[^~\n]+~~|`[^`\n]+`|\[[^\]\n]+\]\([^)]+\)/
const BLOCK_MARKDOWN_RE = /(?:^|\n)\s{0,3}(?:#{1,6}\s+\S|[-*+]\s+\S|\d+\.\s+\S|>\s?\S|```|~~~)/
const HTML_MARKDOWN_RE = /<\/?(?:[abipsu]|blockquote|br|code|del|em|h[1-6]|li|ol|pre|strong|ul)[\s>/]/i
const BLOCK_TAGS = new Set([
  'blockquote',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'ol',
  'p',
  'pre',
  'ul',
])

export interface MatrixMarkdownRender {
  body: string
  formattedBody: string
}

export function renderMarkdownForMatrix(source: string): MatrixMarkdownRender | null {
  const markdown = source.trim()
  if (!markdown || !looksLikeMarkdown(markdown))
    return null

  const rawHtml = marked.parse(markdown, {
    async: false,
    breaks: true,
    gfm: true,
  }) as string
  const formattedBody = sanitizeMatrixHtml(rawHtml)
  const body = htmlToPlainText(formattedBody).trim()

  if (!formattedBody || !body)
    return null

  return { body, formattedBody }
}

export function htmlToPlainText(html: string): string {
  if (typeof DOMParser === 'undefined')
    return html.replace(/<[^>]*>/g, '').replace(/[ \t\r\n]+/g, ' ').trim()

  const doc = new DOMParser().parseFromString(html, 'text/html')
  return normalizePlainText(collectText(doc.body))
}

function looksLikeMarkdown(source: string): boolean {
  return INLINE_MARKDOWN_RE.test(source)
    || BLOCK_MARKDOWN_RE.test(source)
    || HTML_MARKDOWN_RE.test(source)
}

function collectText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE)
    return node.textContent ?? ''

  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE)
    return ''

  if (node instanceof HTMLBRElement)
    return '\n'

  let text = ''
  node.childNodes.forEach((child) => {
    text += collectText(child)
  })

  if (node instanceof HTMLElement && BLOCK_TAGS.has(node.tagName.toLowerCase()))
    return `${text}\n`

  return text
}

function normalizePlainText(text: string): string {
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

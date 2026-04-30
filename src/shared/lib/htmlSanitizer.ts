import DOMPurify from 'dompurify'

/** Shared DOMPurify sanitization config for Matrix HTML messages */
const MATRIX_HTML_CONFIG = {
  ALLOWED_TAGS: [
    'b',
    'i',
    'em',
    'strong',
    'a',
    'p',
    'br',
    'ul',
    'ol',
    'li',
    'code',
    'pre',
    'blockquote',
    'del',
    's',
    'u',
    'span',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'img',
  ],
  ALLOWED_ATTR: [
    'href',
    'src',
    'target',
    'rel',
    'class',
    'alt',
    'title',
    'width',
    'height',
    'data-width',
    'data-height',
  ],
  ALLOWED_URI_REGEXP: /^(?:https?|mailto|matrix|mxc):/i,
  ALLOW_DATA_ATTR: true,
}

/** Sanitize Matrix HTML content for safe rendering with v-html */
export function sanitizeMatrixHtml(html: string): string {
  return DOMPurify.sanitize(html, MATRIX_HTML_CONFIG)
}

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
  ],
  ALLOWED_ATTR: [
    'href',
    'target',
    'rel',
    'class',
  ],
}

/** Sanitize Matrix HTML content for safe rendering with v-html */
export function sanitizeMatrixHtml(html: string): string {
  return DOMPurify.sanitize(html, MATRIX_HTML_CONFIG)
}

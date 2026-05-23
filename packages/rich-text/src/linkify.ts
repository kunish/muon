const URL_RE = /https?:\/\/[^\s<>"]+/gi

export function hasPlainUrl(text: string): boolean {
  return /https?:\/\/[^\s<>"]+/i.test(text)
}

export function linkifyPlainText(text: string): string {
  let html = ''
  let lastIndex = 0
  for (const match of text.matchAll(URL_RE)) {
    const rawUrl = match[0]
    const index = match.index ?? 0
    const { href, trailing } = stripTrailingUrlPunctuation(rawUrl)
    if (!href) continue

    html += escapeHtmlText(text.slice(lastIndex, index))
    html += `<a href="${escapeHtmlAttribute(href)}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(href)}</a>${escapeHtmlText(trailing)}`
    lastIndex = index + rawUrl.length
  }
  html += escapeHtmlText(text.slice(lastIndex))
  return html
}

function stripTrailingUrlPunctuation(url: string): { href: string; trailing: string } {
  const match = url.match(/[),.;:!?]+$/)
  if (!match) return { href: url, trailing: '' }
  return {
    href: url.slice(0, -match[0].length),
    trailing: match[0],
  }
}

function escapeHtmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replace(/'/g, '&#39;')
}

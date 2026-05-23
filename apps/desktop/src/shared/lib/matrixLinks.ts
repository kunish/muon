export const MATRIX_TO_RE = /^https:\/\/matrix\.to\/#\/([@!#][^?]*)/

/**
 * Handle clicks on rich HTML content that may contain matrix.to mention links.
 * If the clicked link matches a matrix.to user mention, prevents default navigation
 * and calls the provided callback with the userId and event.
 */
export function handleMatrixLinkClick(e: MouseEvent, onUserClick: (userId: string, event: MouseEvent) => void) {
  const target = e.target as HTMLElement
  const anchor = target.closest('a[href]') as HTMLAnchorElement | null
  if (!anchor) return
  const href = anchor.getAttribute('href') || ''
  const match = href.match(MATRIX_TO_RE)
  if (match) {
    e.preventDefault()
    e.stopPropagation()
    const userId = decodeURIComponent(match[1])
    if (userId.startsWith('@')) {
      onUserClick(userId, e)
    }
  }
}

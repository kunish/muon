const FLOAT_MARGIN = 8
const FLOAT_OFFSET = 8

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Calculate floating panel position relative to a trigger element.
 * Prefers placement above the trigger; falls back to below if not enough space.
 */
export function getFloatingPosition(
  triggerEl: HTMLElement,
  panelEl: HTMLElement,
  options?: { margin?: number, offset?: number },
): { left: string, top: string } {
  const margin = options?.margin ?? FLOAT_MARGIN
  const offset = options?.offset ?? FLOAT_OFFSET

  const triggerRect = triggerEl.getBoundingClientRect()
  const panelRect = panelEl.getBoundingClientRect()

  const maxLeft = window.innerWidth - panelRect.width - margin
  let left = triggerRect.left
  if (left > maxLeft) {
    left = triggerRect.right - panelRect.width
  }
  left = clamp(left, margin, Math.max(margin, maxLeft))

  const aboveTop = triggerRect.top - panelRect.height - offset
  const belowTop = triggerRect.bottom + offset
  const canFitAbove = aboveTop >= margin
  const canFitBelow = belowTop + panelRect.height <= window.innerHeight - margin

  let top = canFitAbove || !canFitBelow
    ? aboveTop
    : belowTop

  const maxTop = window.innerHeight - panelRect.height - margin
  top = clamp(top, margin, Math.max(margin, maxTop))

  return {
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
  }
}

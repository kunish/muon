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
  options?: {
    margin?: number
    offset?: number
    align?: 'start' | 'end'
    boundaryRect?: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>
  },
): { left: string; top: string } {
  const margin = options?.margin ?? FLOAT_MARGIN
  const offset = options?.offset ?? FLOAT_OFFSET
  const align = options?.align ?? 'start'
  const boundaryRect = options?.boundaryRect ?? {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  }

  const triggerRect = triggerEl.getBoundingClientRect()
  const panelRect = panelEl.getBoundingClientRect()

  const minLeft = boundaryRect.left + margin
  const maxLeft = boundaryRect.right - panelRect.width - margin
  let left = align === 'end' ? triggerRect.right - panelRect.width : triggerRect.left
  if (left > maxLeft) {
    left = triggerRect.right - panelRect.width
  }
  left = clamp(left, minLeft, Math.max(minLeft, maxLeft))

  const aboveTop = triggerRect.top - panelRect.height - offset
  const belowTop = triggerRect.bottom + offset
  const minTop = boundaryRect.top + margin
  const maxTop = boundaryRect.bottom - panelRect.height - margin
  const canFitAbove = aboveTop >= minTop
  const canFitBelow = belowTop + panelRect.height <= boundaryRect.bottom - margin

  let top = canFitAbove || !canFitBelow ? aboveTop : belowTop

  top = clamp(top, minTop, Math.max(minTop, maxTop))

  return {
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
  }
}

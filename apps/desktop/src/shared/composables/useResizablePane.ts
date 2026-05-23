import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'

export interface ResizablePaneOptions {
  widthStorageKey: string
  collapsedStorageKey?: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
  collapsedWidth?: number
  keyboardStep?: number
  resizeFromCollapsed?: boolean
  collapseThreshold?: number
}

const DEFAULT_COLLAPSED_WIDTH = 0
const DEFAULT_KEYBOARD_STEP = 16

function clampWidth(width: number, minWidth: number, maxWidth: number): number {
  return Math.min(maxWidth, Math.max(minWidth, Math.round(width)))
}

function readStorageValue(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writeStorageValue(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // Persistence is best effort; pane controls still need to work.
  }
}

function readStoredPaneWidth(options: ResizablePaneOptions): number {
  const storedWidth = readStorageValue(options.widthStorageKey)
  if (!storedWidth) return options.defaultWidth

  const parsedWidth = Number.parseInt(storedWidth, 10)
  return Number.isFinite(parsedWidth)
    ? clampWidth(parsedWidth, options.minWidth, options.maxWidth)
    : options.defaultWidth
}

function readStoredCollapsed(options: ResizablePaneOptions): boolean {
  return options.collapsedStorageKey !== undefined ? readStorageValue(options.collapsedStorageKey) === 'true' : false
}

export function useResizablePane(options: ResizablePaneOptions) {
  const collapsedWidth = options.collapsedWidth ?? DEFAULT_COLLAPSED_WIDTH
  const keyboardStep = options.keyboardStep ?? DEFAULT_KEYBOARD_STEP
  const canCollapse = options.collapsedStorageKey !== undefined

  const paneWidth = shallowRef(readStoredPaneWidth(options))
  const isCollapsed = shallowRef(readStoredCollapsed(options))
  const isResizing = shallowRef(false)
  const resizeStartX = shallowRef(0)
  const resizeStartWidth = shallowRef(paneWidth.value)

  let previousBodyCursor = ''
  let previousBodyUserSelect = ''

  const visiblePaneWidth = computed(() => (canCollapse && isCollapsed.value ? collapsedWidth : paneWidth.value))
  const paneStyle = computed(() => ({
    width: `${visiblePaneWidth.value}px`,
  }))

  function setDocumentResizeState(active: boolean): void {
    if (typeof document === 'undefined') return

    if (active) {
      previousBodyCursor = document.body.style.cursor
      previousBodyUserSelect = document.body.style.userSelect
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      return
    }

    document.body.style.cursor = previousBodyCursor
    document.body.style.userSelect = previousBodyUserSelect
  }

  function stopResize(): void {
    if (!isResizing.value) return

    isResizing.value = false
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', onResizeMove)
      window.removeEventListener('pointerup', stopResize)
      window.removeEventListener('pointercancel', stopResize)
    }
    setDocumentResizeState(false)
  }

  function onResizeMove(event: PointerEvent): void {
    if (!isResizing.value) return

    const nextWidth = resizeStartWidth.value + event.clientX - resizeStartX.value
    if (canCollapse && options.collapseThreshold !== undefined) {
      if (nextWidth <= options.collapseThreshold) {
        isCollapsed.value = true
        return
      }

      isCollapsed.value = false
    }

    paneWidth.value = clampWidth(nextWidth, options.minWidth, options.maxWidth)
  }

  function startResize(event: PointerEvent): void {
    if (event.button !== 0) return

    if (canCollapse && isCollapsed.value && !options.resizeFromCollapsed) return

    event.preventDefault()
    isResizing.value = true
    resizeStartX.value = event.clientX
    resizeStartWidth.value = canCollapse && isCollapsed.value ? collapsedWidth : paneWidth.value
    if (canCollapse && options.collapseThreshold === undefined) isCollapsed.value = false
    setDocumentResizeState(true)

    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', onResizeMove)
      window.addEventListener('pointerup', stopResize)
      window.addEventListener('pointercancel', stopResize)
    }
  }

  function toggleCollapse(): void {
    stopResize()
    if (!canCollapse) {
      isCollapsed.value = false
      return
    }

    isCollapsed.value = !isCollapsed.value
  }

  function restorePane(): void {
    stopResize()
    paneWidth.value = options.defaultWidth
    isCollapsed.value = false
  }

  function resizeBy(delta: number): void {
    if (canCollapse && isCollapsed.value) return

    paneWidth.value = clampWidth(paneWidth.value + delta, options.minWidth, options.maxWidth)
  }

  function onResizeHandleKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      resizeBy(-keyboardStep)
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      resizeBy(keyboardStep)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      paneWidth.value = options.minWidth
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      paneWidth.value = options.maxWidth
    }
  }

  function readStoredPaneState(): void {
    paneWidth.value = readStoredPaneWidth(options)
    isCollapsed.value = readStoredCollapsed(options)
  }

  onMounted(readStoredPaneState)
  onUnmounted(stopResize)

  watch(paneWidth, (width) => writeStorageValue(options.widthStorageKey, String(width)))
  watch(isCollapsed, (collapsed) => {
    if (options.collapsedStorageKey !== undefined) writeStorageValue(options.collapsedStorageKey, String(collapsed))
  })

  return {
    paneWidth,
    paneStyle,
    visiblePaneWidth,
    isCollapsed,
    isResizing,
    startResize,
    stopResize,
    toggleCollapse,
    restorePane,
    onResizeHandleKeydown,
  }
}

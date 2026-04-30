import type { MaybeRefOrGetter, Ref } from 'vue'
import { computed, nextTick, onMounted, onUnmounted, shallowRef, toValue, watch } from 'vue'

export interface ViewportPoint {
  x: number
  y: number
}

export interface FloatingSize {
  width: number
  height: number
}

interface ViewportSize {
  width: number
  height: number
}

interface UseViewportClampedFloatingOptions {
  open: MaybeRefOrGetter<boolean>
  position: MaybeRefOrGetter<ViewportPoint>
  element: Ref<HTMLElement | null>
  fallbackSize: FloatingSize
  margin?: number
}

const DEFAULT_MARGIN = 16

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function readViewportSize(): ViewportSize {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 }
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

function getClampedPosition(
  position: ViewportPoint,
  size: FloatingSize,
  viewport: ViewportSize,
  margin: number,
) {
  const maxLeft = Math.max(margin, viewport.width - size.width - margin)
  const maxTop = Math.max(margin, viewport.height - size.height - margin)

  return {
    left: `${Math.round(clamp(position.x, margin, maxLeft))}px`,
    top: `${Math.round(clamp(position.y, margin, maxTop))}px`,
  }
}

export function useViewportClampedFloating(options: UseViewportClampedFloatingOptions) {
  const margin = options.margin ?? DEFAULT_MARGIN
  const floatingSize = shallowRef<FloatingSize>(options.fallbackSize)
  const viewportSize = shallowRef<ViewportSize>(readViewportSize())

  function syncFloatingLayout() {
    viewportSize.value = readViewportSize()

    const rect = options.element.value?.getBoundingClientRect()
    if (!rect)
      return

    floatingSize.value = {
      width: rect.width || options.fallbackSize.width,
      height: rect.height || options.fallbackSize.height,
    }
  }

  async function syncFloatingLayoutAfterRender() {
    await nextTick()
    if (toValue(options.open))
      syncFloatingLayout()
  }

  const style = computed(() => {
    if (!toValue(options.open)) {
      return { display: 'none' }
    }

    return getClampedPosition(
      toValue(options.position),
      floatingSize.value,
      viewportSize.value,
      margin,
    )
  })

  function onResize() {
    if (toValue(options.open))
      syncFloatingLayout()
  }

  watch(
    () => toValue(options.open),
    (open) => {
      if (open)
        void syncFloatingLayoutAfterRender()
    },
  )

  watch(
    () => toValue(options.position),
    () => {
      if (toValue(options.open))
        void syncFloatingLayoutAfterRender()
    },
  )

  onMounted(() => {
    window.addEventListener('resize', onResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', onResize)
  })

  return {
    style,
    syncFloatingLayout,
    syncFloatingLayoutAfterRender,
  }
}

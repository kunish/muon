const SCROLL_KEYS = new Set([
  ' ',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
])

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

function preventDefaultScroll(event: Event): void {
  if (event.cancelable) event.preventDefault()
}

export function useContextMenuScrollLock(open: MaybeRefOrGetter<boolean>): void {
  let locked = false

  function onWheel(event: WheelEvent): void {
    preventDefaultScroll(event)
  }

  function onTouchMove(event: TouchEvent): void {
    preventDefaultScroll(event)
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (isEditableTarget(event.target)) return
    if (SCROLL_KEYS.has(event.key)) preventDefaultScroll(event)
  }

  function lock(): void {
    if (locked || typeof document === 'undefined') return

    document.addEventListener('wheel', onWheel, { capture: true, passive: false })
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })
    document.addEventListener('keydown', onKeyDown, { capture: true })
    locked = true
  }

  function unlock(): void {
    if (!locked || typeof document === 'undefined') return

    document.removeEventListener('wheel', onWheel, true)
    document.removeEventListener('touchmove', onTouchMove, true)
    document.removeEventListener('keydown', onKeyDown, true)
    locked = false
  }

  watch(
    () => Boolean(toValue(open)),
    (isOpen) => {
      if (isOpen) lock()
      else unlock()
    },
    { immediate: true },
  )

  onUnmounted(unlock)
}

import type { MaybeRefOrGetter } from 'vue'
import { computed, onUnmounted, shallowRef, toValue, watch } from 'vue'

const openMessageContextMenuCount = shallowRef(0)

const isAnyMessageContextMenuOpen = computed(() => openMessageContextMenuCount.value > 0)

export function useMessageContextMenuState(open: MaybeRefOrGetter<boolean>) {
  let contributes = false

  function setContributes(shouldContribute: boolean): void {
    if (shouldContribute === contributes) return

    contributes = shouldContribute
    openMessageContextMenuCount.value = Math.max(0, openMessageContextMenuCount.value + (shouldContribute ? 1 : -1))
  }

  watch(() => Boolean(toValue(open)), setContributes, { immediate: true })

  onUnmounted(() => setContributes(false))

  return {
    isAnyMessageContextMenuOpen,
  }
}

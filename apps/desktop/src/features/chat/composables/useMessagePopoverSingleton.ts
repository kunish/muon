const activeMessagePopoverOwner = shallowRef<symbol | null>(null)

export function useMessagePopoverSingleton() {
  const owner = Symbol('message-popover-owner')
  const isActiveMessagePopover = computed(() => activeMessagePopoverOwner.value === owner)

  function activateMessagePopover(): void {
    activeMessagePopoverOwner.value = owner
  }

  function deactivateMessagePopover(): void {
    if (activeMessagePopoverOwner.value === owner) {
      activeMessagePopoverOwner.value = null
    }
  }

  onUnmounted(deactivateMessagePopover)

  return {
    isActiveMessagePopover,
    activateMessagePopover,
    deactivateMessagePopover,
  }
}

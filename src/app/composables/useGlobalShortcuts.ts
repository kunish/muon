import { useChatStore } from '@features/chat/stores/chatStore'
import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGlobalUiStore } from '../stores/globalUiStore'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement))
    return false

  if (target.isContentEditable)
    return true

  const tagName = target.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select'
}

function isPlainModifier(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey
}

export function useGlobalShortcuts(): void {
  const router = useRouter()
  const globalUi = useGlobalUiStore()
  const chatStore = useChatStore()

  function closeTopmostTransient(): boolean {
    if (globalUi.globalSearchOpen) {
      globalUi.closeGlobalSearch()
      return true
    }

    if (globalUi.newChatOpen) {
      globalUi.closeNewChat()
      return true
    }

    if (chatStore.contextMenu) {
      chatStore.closeContextMenu()
      return true
    }

    if (chatStore.activeSidePanel) {
      chatStore.closeSidePanel()
      return true
    }

    if (chatStore.activeThreadId) {
      chatStore.closeThread()
      return true
    }

    if (chatStore.multiSelectMode) {
      chatStore.exitMultiSelect()
      return true
    }

    return false
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.isComposing)
      return

    const key = event.key.toLowerCase()

    if (isPlainModifier(event) && key === 'k') {
      event.preventDefault()
      globalUi.openGlobalSearch()
      return
    }

    if (isPlainModifier(event) && event.key === ',') {
      event.preventDefault()
      globalUi.closeTransientOverlays()
      void router.push('/settings')
      return
    }

    if (isPlainModifier(event) && key === 'n') {
      event.preventDefault()
      globalUi.openNewChat()
      return
    }

    if (event.key !== 'Escape')
      return

    if (!globalUi.globalSearchOpen && !globalUi.newChatOpen && isEditableTarget(event.target))
      return

    if (closeTopmostTransient())
      event.preventDefault()
  }

  onMounted(() => {
    document.addEventListener('keydown', onKeydown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown)
  })
}

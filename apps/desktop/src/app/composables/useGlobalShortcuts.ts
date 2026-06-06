import {
  chatStore,
  closeContextMenu,
  closeSidePanel,
  closeThread,
  exitMultiSelect,
} from '@features/chat/stores/chatStore'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getWorkspaceAppForPath, workspaceApps } from '../components/workspace/navigation'
import {
  closeGlobalSearch,
  closeNewChat,
  closeTransientOverlays,
  globalUiStore,
  openGlobalSearch,
  openNewChat,
} from '../stores/globalUiStore'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  if (target.isContentEditable) return true

  const tagName = target.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select'
}

function isPlainModifier(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey
}

export function useGlobalShortcuts(): void {
  const route = useRoute()
  const router = useRouter()
  const lastMessagesPath = ref('/dm')

  watch(
    () => route.fullPath,
    () => {
      if (getWorkspaceAppForPath(route.path).id === 'messages') {
        lastMessagesPath.value = route.fullPath || route.path || '/dm'
      }
    },
    { immediate: true },
  )

  function closeTopmostTransient(): boolean {
    if (globalUiStore.state.globalSearchOpen) {
      closeGlobalSearch()
      return true
    }

    if (globalUiStore.state.newChatOpen) {
      closeNewChat()
      return true
    }

    if (chatStore.state.contextMenu) {
      closeContextMenu()
      return true
    }

    if (chatStore.state.activeSidePanel) {
      closeSidePanel()
      return true
    }

    if (chatStore.state.activeThreadId) {
      closeThread()
      return true
    }

    if (chatStore.state.multiSelectMode) {
      exitMultiSelect()
      return true
    }

    return false
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.isComposing) return

    const key = event.key.toLowerCase()

    if (isPlainModifier(event) && key === 'k') {
      event.preventDefault()
      openGlobalSearch()
      return
    }

    if (isPlainModifier(event) && event.key === ',') {
      event.preventDefault()
      closeTransientOverlays()
      void router.push('/settings')
      return
    }

    if (isPlainModifier(event) && key === 'n') {
      event.preventDefault()
      openNewChat()
      return
    }

    // 飞书风格 Cmd/Ctrl+数字键 切换应用
    if (isPlainModifier(event) && key >= '1' && key <= '9') {
      event.preventDefault()
      const primaryApps = workspaceApps.filter((a) => a.id !== 'settings')
      const index = Number.parseInt(key, 10) - 1
      if (index < primaryApps.length) {
        const app = primaryApps[index]
        router.push(app.id === 'messages' ? lastMessagesPath.value : app.path)
      }
      return
    }

    if (event.key !== 'Escape') return

    if (!globalUiStore.state.globalSearchOpen && !globalUiStore.state.newChatOpen && isEditableTarget(event.target))
      return

    if (closeTopmostTransient()) event.preventDefault()
  }

  onMounted(() => {
    document.addEventListener('keydown', onKeydown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown)
  })
}

import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

export const useGlobalUiStore = defineStore('global-ui', () => {
  const globalSearchOpen = shallowRef(false)
  const newChatOpen = shallowRef(false)

  function openGlobalSearch(): void {
    globalSearchOpen.value = true
  }

  function closeGlobalSearch(): void {
    globalSearchOpen.value = false
  }

  function openNewChat(): void {
    newChatOpen.value = true
  }

  function closeNewChat(): void {
    newChatOpen.value = false
  }

  function closeTransientOverlays(): void {
    closeGlobalSearch()
    closeNewChat()
  }

  return {
    globalSearchOpen,
    newChatOpen,
    openGlobalSearch,
    closeGlobalSearch,
    openNewChat,
    closeNewChat,
    closeTransientOverlays,
  }
})

import { Store } from '@tanstack/vue-store'

export interface GlobalUiState {
  globalSearchOpen: boolean
  newChatOpen: boolean
}

function createInitialState(): GlobalUiState {
  return {
    globalSearchOpen: false,
    newChatOpen: false,
  }
}

export const globalUiStore = new Store<GlobalUiState>(createInitialState())

export function openGlobalSearch(): void {
  globalUiStore.setState((s) => ({ ...s, globalSearchOpen: true }))
}

export function closeGlobalSearch(): void {
  globalUiStore.setState((s) => ({ ...s, globalSearchOpen: false }))
}

export function openNewChat(): void {
  globalUiStore.setState((s) => ({ ...s, newChatOpen: true }))
}

export function closeNewChat(): void {
  globalUiStore.setState((s) => ({ ...s, newChatOpen: false }))
}

export function closeTransientOverlays(): void {
  closeGlobalSearch()
  closeNewChat()
}

/** Reset to initial state. Used by tests for isolation and by future logout cleanup. */
export function resetGlobalUiStore(): void {
  globalUiStore.setState(() => createInitialState())
}

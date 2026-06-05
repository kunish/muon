import { beforeEach, describe, expect, it } from 'vitest'
import {
  closeGlobalSearch,
  closeNewChat,
  closeTransientOverlays,
  globalUiStore,
  openGlobalSearch,
  openNewChat,
  resetGlobalUiStore,
} from '@/app/stores/globalUiStore'

describe('globalUiStore', () => {
  beforeEach(() => {
    resetGlobalUiStore()
  })

  it('starts with globalSearchOpen and newChatOpen both false', () => {
    expect(globalUiStore.state.globalSearchOpen).toBe(false)
    expect(globalUiStore.state.newChatOpen).toBe(false)
  })

  it('openGlobalSearch sets globalSearchOpen to true', () => {
    openGlobalSearch()
    expect(globalUiStore.state.globalSearchOpen).toBe(true)
  })

  it('closeGlobalSearch sets globalSearchOpen to false', () => {
    openGlobalSearch()
    closeGlobalSearch()
    expect(globalUiStore.state.globalSearchOpen).toBe(false)
  })

  it('openNewChat sets newChatOpen to true', () => {
    openNewChat()
    expect(globalUiStore.state.newChatOpen).toBe(true)
  })

  it('closeNewChat sets newChatOpen to false', () => {
    openNewChat()
    closeNewChat()
    expect(globalUiStore.state.newChatOpen).toBe(false)
  })

  it('closeTransientOverlays closes both search and new chat', () => {
    openGlobalSearch()
    openNewChat()
    expect(globalUiStore.state.globalSearchOpen).toBe(true)
    expect(globalUiStore.state.newChatOpen).toBe(true)

    closeTransientOverlays()
    expect(globalUiStore.state.globalSearchOpen).toBe(false)
    expect(globalUiStore.state.newChatOpen).toBe(false)
  })

  it('global search and new chat can be open at the same time', () => {
    openGlobalSearch()
    openNewChat()
    expect(globalUiStore.state.globalSearchOpen).toBe(true)
    expect(globalUiStore.state.newChatOpen).toBe(true)
  })

  it('closing one overlay does not affect the other', () => {
    openGlobalSearch()
    openNewChat()

    closeGlobalSearch()
    expect(globalUiStore.state.globalSearchOpen).toBe(false)
    expect(globalUiStore.state.newChatOpen).toBe(true)

    openGlobalSearch()
    closeNewChat()
    expect(globalUiStore.state.globalSearchOpen).toBe(true)
    expect(globalUiStore.state.newChatOpen).toBe(false)
  })
})

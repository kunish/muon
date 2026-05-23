import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

describe('globalUiStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with globalSearchOpen and newChatOpen both false', async () => {
    const { useGlobalUiStore } = await import('@/app/stores/globalUiStore')
    const store = useGlobalUiStore()

    expect(store.globalSearchOpen).toBe(false)
    expect(store.newChatOpen).toBe(false)
  })

  it('openGlobalSearch sets globalSearchOpen to true', async () => {
    const { useGlobalUiStore } = await import('@/app/stores/globalUiStore')
    const store = useGlobalUiStore()

    store.openGlobalSearch()
    expect(store.globalSearchOpen).toBe(true)
  })

  it('closeGlobalSearch sets globalSearchOpen to false', async () => {
    const { useGlobalUiStore } = await import('@/app/stores/globalUiStore')
    const store = useGlobalUiStore()

    store.openGlobalSearch()
    store.closeGlobalSearch()
    expect(store.globalSearchOpen).toBe(false)
  })

  it('openNewChat sets newChatOpen to true', async () => {
    const { useGlobalUiStore } = await import('@/app/stores/globalUiStore')
    const store = useGlobalUiStore()

    store.openNewChat()
    expect(store.newChatOpen).toBe(true)
  })

  it('closeNewChat sets newChatOpen to false', async () => {
    const { useGlobalUiStore } = await import('@/app/stores/globalUiStore')
    const store = useGlobalUiStore()

    store.openNewChat()
    store.closeNewChat()
    expect(store.newChatOpen).toBe(false)
  })

  it('closeTransientOverlays closes both search and new chat', async () => {
    const { useGlobalUiStore } = await import('@/app/stores/globalUiStore')
    const store = useGlobalUiStore()

    store.openGlobalSearch()
    store.openNewChat()
    expect(store.globalSearchOpen).toBe(true)
    expect(store.newChatOpen).toBe(true)

    store.closeTransientOverlays()
    expect(store.globalSearchOpen).toBe(false)
    expect(store.newChatOpen).toBe(false)
  })

  it('global search and new chat can be open at the same time', async () => {
    const { useGlobalUiStore } = await import('@/app/stores/globalUiStore')
    const store = useGlobalUiStore()

    store.openGlobalSearch()
    store.openNewChat()
    expect(store.globalSearchOpen).toBe(true)
    expect(store.newChatOpen).toBe(true)
  })

  it('closing one overlay does not affect the other', async () => {
    const { useGlobalUiStore } = await import('@/app/stores/globalUiStore')
    const store = useGlobalUiStore()

    store.openGlobalSearch()
    store.openNewChat()

    store.closeGlobalSearch()
    expect(store.globalSearchOpen).toBe(false)
    expect(store.newChatOpen).toBe(true)

    store.openGlobalSearch()
    store.closeNewChat()
    expect(store.globalSearchOpen).toBe(true)
    expect(store.newChatOpen).toBe(false)
  })
})

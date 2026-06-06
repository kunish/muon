import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ConversationContextMenu from '@/features/chat/components/ConversationContextMenu.vue'
import {
  getMuteExpiry,
  isMuted,
  muteWithExpiry,
  openContextMenu,
  resetChatStore,
} from '@/features/chat/stores/chatStore'

enableAutoUnmount(afterEach)

const { toggleRoomMute } = vi.hoisted(() => ({ toggleRoomMute: vi.fn().mockResolvedValue(undefined) }))

vi.mock('@matrix/index', () => ({
  leaveRoom: vi.fn().mockResolvedValue(undefined),
  toggleRoomMute,
  toggleRoomPin: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@matrix/roomUtils', () => ({
  isDirectRoom: vi.fn(() => false),
}))

vi.mock('@/desktop/dialog', () => ({ ask: vi.fn() }))

vi.mock('@/features/chat/composables/useConversations', () => ({
  useConversations: () => ({ archiveDm: vi.fn(), refresh: vi.fn(), removeRoom: vi.fn() }),
}))

const ROOM = '!room:localhost'

function clickBody(testid: string) {
  const button = document.body.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`)
  expect(button, testid).not.toBeNull()
  button!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

describe('conversation context menu timed mute', () => {
  beforeEach(() => {
    resetChatStore()
    localStorage.clear()
    toggleRoomMute.mockClear()
    document.body.innerHTML = ''
  })

  it('expands timed mute options and mutes for 1 hour with a server push rule', async () => {
    mount(ConversationContextMenu, { attachTo: document.body })
    openContextMenu(ROOM, 100, 100)
    await nextTick()

    // Not muted yet → the toggle expands the duration options instead of muting directly.
    clickBody('ctx-mute-toggle')
    await nextTick()
    expect(document.body.querySelector('[data-testid="ctx-mute-options"]')).not.toBeNull()

    clickBody('ctx-mute-1h')
    await flushPromises()

    expect(isMuted(ROOM)).toBe(true)
    const expiry = getMuteExpiry(ROOM)
    expect(expiry).toBeGreaterThan(Date.now())
    expect(toggleRoomMute).toHaveBeenCalledWith(ROOM)
  })

  it('mutes forever without an expiry', async () => {
    mount(ConversationContextMenu, { attachTo: document.body })
    openContextMenu(ROOM, 100, 100)
    await nextTick()

    clickBody('ctx-mute-toggle')
    await nextTick()
    clickBody('ctx-mute-forever')
    await flushPromises()

    expect(isMuted(ROOM)).toBe(true)
    expect(getMuteExpiry(ROOM)).toBeUndefined()
    expect(toggleRoomMute).toHaveBeenCalledWith(ROOM)
  })

  it('shows a single unmute action when already muted', async () => {
    muteWithExpiry(ROOM, null)
    mount(ConversationContextMenu, { attachTo: document.body })
    openContextMenu(ROOM, 100, 100)
    await nextTick()

    // Already muted → no expand options, just unmute.
    expect(document.body.querySelector('[data-testid="ctx-mute-1h"]')).toBeNull()
    clickBody('ctx-mute-toggle')
    await flushPromises()

    expect(isMuted(ROOM)).toBe(false)
    expect(toggleRoomMute).toHaveBeenCalledWith(ROOM)
  })
})

import type { ComposerMentionRequest, SidebarPlacement, SidebarPreviewInput } from '@/features/chat/stores/chatStore'
/**
 * Shared room-navigation facade.
 *
 * Cross-feature consumers (server, contacts) use this composable instead of
 * importing from the chat feature's store directly.  The facade keeps the
 * chat store as an implementation detail so callers are not coupled to the
 * internal store shape.
 */
import { computed } from 'vue'
import { useChatStore } from '@/features/chat/stores/chatStore'

export type { SidebarPlacement, SidebarPreviewInput }

export interface NavigateToRoomOptions {
  sidebarPlacement?: SidebarPlacement
  sidebarPreview?: SidebarPreviewInput
}

export function useRoomNavigation() {
  const store = useChatStore()

  /** Navigate to a room, optionally promoting it in the sidebar. */
  function navigateToRoom(roomId: string | null, options: NavigateToRoomOptions = {}) {
    store.setCurrentRoom(roomId, options)
  }

  /** Request an @-mention insertion in the composer. */
  function requestMention(mention: ComposerMentionRequest) {
    store.requestMention(mention)
  }

  /** The currently active room id (read-only from outside chat). */
  const currentRoomId = computed(() => store.currentRoomId)

  return { navigateToRoom, requestMention, currentRoomId }
}

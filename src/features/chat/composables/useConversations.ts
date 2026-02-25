import type { RoomSummary } from '@matrix/types'
import { getRoomSummaries, matrixEvents } from '@matrix/index'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useChatStore } from '../stores/chatStore'

export function useConversations() {
  const store = useChatStore()
  const rooms = ref<RoomSummary[]>([])

  function refresh() {
    rooms.value = getRoomSummaries()
  }

  const filtered = computed(() => {
    const q = store.searchQuery.toLowerCase()
    if (!q)
      return rooms.value
    return rooms.value.filter(r => r.name.toLowerCase().includes(q))
  })

  onMounted(() => {
    refresh()
    matrixEvents.on('room.message', refresh)
    matrixEvents.on('room.member', refresh)
    matrixEvents.on('sync.state', refresh)
  })

  onUnmounted(() => {
    matrixEvents.off('room.message', refresh)
    matrixEvents.off('room.member', refresh)
    matrixEvents.off('sync.state', refresh)
  })

  return { conversations: filtered, refresh }
}

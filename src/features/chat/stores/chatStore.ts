import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useChatStore = defineStore('chat', () => {
  const currentRoomId = ref<string | null>(null)
  const searchQuery = ref('')

  function setCurrentRoom(roomId: string | null) {
    currentRoomId.value = roomId
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  return { currentRoomId, searchQuery, setCurrentRoom, setSearchQuery }
})

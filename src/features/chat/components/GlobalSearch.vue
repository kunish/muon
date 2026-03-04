<script setup lang="ts">
import { getClient } from '@matrix/client'
import { Search } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

const router = useRouter()
const query = ref('')
const client = getClient()

const rooms = computed(() => {
  const all = client.getRooms().filter(r => r.getMyMembership() === 'join')
  if (!query.value.trim())
    return all.slice(0, 10)
  const q = query.value.toLowerCase()
  return all.filter(r =>
    (r.name || '').toLowerCase().includes(q)
    || r.roomId.toLowerCase().includes(q),
  )
})

function selectRoom(roomId: string) {
  router.push(`/chat/${encodeURIComponent(roomId)}`)
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape')
    emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[15vh]" @click.self="emit('close')">
      <div class="bg-background rounded-xl shadow-2xl w-[480px] max-h-[60vh] flex flex-col">
        <div class="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search :size="16" class="text-muted-foreground shrink-0" />
          <input
            v-model="query"
            type="text"
            :placeholder="t('chat.search_conversations')"
            class="flex-1 bg-transparent text-sm outline-none"
            autofocus
          >
          <kbd class="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        <div class="flex-1 overflow-y-auto py-1">
          <div
            v-for="r in rooms"
            :key="r.roomId"
            class="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent/50"
            @click="selectRoom(r.roomId)"
          >
            <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0">
              {{ (r.name || '?').slice(0, 1) }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm truncate">
                {{ r.name || r.roomId }}
              </div>
            </div>
          </div>

          <div
            v-if="rooms.length === 0"
            class="px-4 py-6 text-center text-sm text-muted-foreground"
          >
            {{ t('chat.search_no_match') }}
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

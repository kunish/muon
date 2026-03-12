<script setup lang="ts">
import type { MatrixEvent } from 'matrix-js-sdk'
import { getClient } from '@matrix/client'
import { forwardMessages } from '@matrix/messages'
import { Layers, Search, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

const props = defineProps<{
  event?: MatrixEvent
  roomId?: string
  eventIds?: string[]
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

const client = getClient()
const searchQuery = ref('')
const sending = ref<string | null>(null)

const isMergedForward = computed(() => (props.eventIds?.length ?? 0) > 1)
const messageCount = computed(() => props.eventIds?.length ?? 1)

const rooms = computed(() => {
  const all = client.getRooms().filter(r => r.getMyMembership() === 'join')
  if (!searchQuery.value.trim())
    return all
  const q = searchQuery.value.toLowerCase()
  return all.filter(r => (r.name || '').toLowerCase().includes(q))
})

async function forwardTo(targetRoomId: string) {
  sending.value = targetRoomId
  try {
    if (isMergedForward.value && props.roomId && props.eventIds) {
      await forwardMessages(props.roomId, targetRoomId, props.eventIds)
    }
    else if (props.event) {
      const content = props.event.getContent()
      await client.sendMessage(targetRoomId, {
        ...content,
        'm.relates_to': undefined,
      } as any)
    }
    emit('close')
  }
  catch {
    toast.error(t('auth.error'))
  }
  finally {
    sending.value = null
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" @click.self="emit('close')">
      <div class="bg-background rounded-xl shadow-2xl w-[360px] max-h-[70vh] flex flex-col">
        <div class="flex items-center justify-between p-4 border-b border-border">
          <h3 class="font-medium text-sm">
            {{ isMergedForward ? t('chat.merged_forward') : t('chat.forward_message') }}
          </h3>
          <button class="p-1 rounded hover:bg-accent" @click="emit('close')">
            <X :size="16" />
          </button>
        </div>

        <div v-if="isMergedForward" class="mx-3 mt-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 flex items-center gap-2">
          <Layers :size="14" class="text-primary" />
          <span class="text-xs text-primary">{{ t('chat.merged_forward_n', { n: messageCount }) }}</span>
        </div>

        <div class="p-3">
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
            <Search :size="14" class="text-muted-foreground" />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('chat.search_conversation')"
              class="flex-1 bg-transparent text-sm outline-none"
            >
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-2 pb-3">
          <div
            v-for="r in rooms"
            :key="r.roomId"
            class="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer hover:bg-accent/50"
            @click="forwardTo(r.roomId)"
          >
            <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
              {{ (r.name || '?').slice(0, 1) }}
            </div>
            <div class="flex-1 min-w-0 text-sm truncate">
              {{ r.name || r.roomId }}
            </div>
            <span
              v-if="sending === r.roomId"
              class="text-xs text-muted-foreground"
            >{{ t('chat.sending') }}</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

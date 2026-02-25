<script setup lang="ts">
import { getClient } from '@matrix/client'
import { format } from 'date-fns'
import { Copy, Edit, Reply, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'
import AudioMessage from './messages/AudioMessage.vue'
import FileMessage from './messages/FileMessage.vue'
import ImageMessage from './messages/ImageMessage.vue'
import VideoMessage from './messages/VideoMessage.vue'

const props = defineProps<{
  event: any
  isMine: boolean
  showSender: boolean
}>()

const emit = defineEmits<{
  reply: [event: any]
  edit: [event: any]
  redact: [event: any]
}>()

const msgtype = computed(() => props.event.getContent()?.msgtype)

const body = computed(() => props.event.getContent()?.body || '')
const sender = computed(() => props.event.getSender() || '')
const time = computed(() => format(props.event.getTs(), 'HH:mm'))

const senderName = computed(() => {
  const client = getClient()
  const room = client.getRoom(props.event.getRoomId()!)
  const member = room?.getMember(sender.value)
  return member?.name || sender.value
})

function copyText() {
  navigator.clipboard.writeText(body.value)
}
</script>

<template>
  <div
    class="group flex px-4 py-0.5"
    :class="isMine ? 'justify-end' : 'justify-start'"
  >
    <div class="max-w-[70%] relative">
      <div
        v-if="showSender && !isMine"
        class="text-xs text-muted-foreground mb-0.5 px-1"
      >
        {{ senderName }}
      </div>

      <div
        class="rounded-2xl text-sm break-words"
        :class="[
          isMine
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted rounded-bl-sm',
          msgtype === 'm.image' || msgtype === 'm.video' ? 'p-1' : 'px-3 py-2',
        ]"
      >
        <ImageMessage v-if="msgtype === 'm.image'" :event="event" />
        <VideoMessage v-else-if="msgtype === 'm.video'" :event="event" />
        <AudioMessage v-else-if="msgtype === 'm.audio'" :event="event" />
        <FileMessage v-else-if="msgtype === 'm.file'" :event="event" />
        <template v-else>
          {{ body }}
        </template>
      </div>

      <div
        class="flex items-center gap-0.5 mt-0.5 px-1"
        :class="isMine ? 'justify-end' : 'justify-start'"
      >
        <span class="text-[10px] text-muted-foreground">{{ time }}</span>
      </div>

      <!-- Context actions -->
      <div
        class="absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-background border border-border rounded-md shadow-sm p-0.5"
        :class="isMine ? 'right-full mr-1' : 'left-full ml-1'"
      >
        <button class="p-1 rounded hover:bg-accent" title="复制" @click="copyText">
          <Copy :size="12" />
        </button>
        <button class="p-1 rounded hover:bg-accent" title="回复" @click="emit('reply', event)">
          <Reply :size="12" />
        </button>
        <button
          v-if="isMine"
          class="p-1 rounded hover:bg-accent"
          title="编辑"
          @click="emit('edit', event)"
        >
          <Edit :size="12" />
        </button>
        <button
          v-if="isMine"
          class="p-1 rounded hover:bg-accent text-destructive"
          title="撤回"
          @click="emit('redact', event)"
        >
          <Trash2 :size="12" />
        </button>
      </div>
    </div>
  </div>
</template>

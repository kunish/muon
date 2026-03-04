<script setup lang="ts">
import { sendTextMessage } from '@matrix/index'
import { Send } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTyping } from '../composables/useTyping'
import { useChatStore } from '../stores/chatStore'

const store = useChatStore()
const { t } = useI18n()
const { startTyping, stopTyping } = useTyping()
const text = ref('')
const textareaRef = ref<HTMLTextAreaElement>()

function adjustHeight() {
  const el = textareaRef.value
  if (!el)
    return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`
}

async function send() {
  const roomId = store.currentRoomId
  const msg = text.value.trim()
  if (!roomId || !msg)
    return
  text.value = ''
  stopTyping()
  if (roomId)
    store.setDraft(roomId, '')
  if (textareaRef.value)
    textareaRef.value.style.height = 'auto'
  await sendTextMessage(roomId, msg)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

function onInput() {
  adjustHeight()
  startTyping()
}

// 切换房间时保存草稿 & 恢复草稿
watch(() => store.currentRoomId, (newId, oldId) => {
  // 保存旧房间草稿
  if (oldId) {
    store.setDraft(oldId, text.value)
  }
  // 恢复新房间草稿
  text.value = newId ? store.getDraft(newId) : ''
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    if (text.value) {
      requestAnimationFrame(adjustHeight)
    }
  }
})
</script>

<template>
  <div class="border-t border-border px-4 py-3">
    <div class="flex items-end gap-2">
      <textarea
        ref="textareaRef"
        v-model="text"
        rows="1"
        :placeholder="t('chat.input_placeholder')"
        class="flex-1 resize-none bg-muted rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted-foreground max-h-[120px]"
        @keydown="onKeydown"
        @input="onInput"
      />
      <button
        class="shrink-0 p-2 rounded-lg transition-colors"
        :class="text.trim() ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
        :disabled="!text.trim()"
        @click="send"
      >
        <Send :size="18" />
      </button>
    </div>
  </div>
</template>

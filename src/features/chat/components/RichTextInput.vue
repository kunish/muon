<script setup lang="ts">
import { sendTextMessage } from '@matrix/index'
import { EditorContent } from '@tiptap/vue-3'
import { Send } from 'lucide-vue-next'
import { watch } from 'vue'
import { useEditor } from '../composables/useEditor'
import { useTyping } from '../composables/useTyping'
import { useChatStore } from '../stores/chatStore'
import EmojiButton from './EmojiButton.vue'

const store = useChatStore()
const { startTyping, stopTyping } = useTyping()

const { editor, clear, insertEmoji } = useEditor({
  placeholder: '输入消息...',
  onSubmit: handleSend,
})

async function handleSend(html: string, text: string) {
  const roomId = store.currentRoomId
  if (!roomId || !text.trim())
    return
  clear()
  stopTyping()
  await sendTextMessage(roomId, text)
}

function onInput() {
  startTyping()
}

watch(() => store.currentRoomId, () => {
  clear()
})
</script>

<template>
  <div class="border-t border-border px-4 py-3">
    <div
      class="rounded-lg bg-muted overflow-hidden"
      @input="onInput"
    >
      <EditorContent
        v-if="editor"
        :editor="editor"
        class="rich-editor min-h-[40px] max-h-[150px] overflow-y-auto px-3 py-2 text-sm outline-none"
      />
      <div class="flex items-center justify-between px-2 pb-2">
        <div class="flex items-center gap-1">
          <EmojiButton @select="insertEmoji" />
        </div>
        <button
          class="p-2 rounded-lg transition-colors"
          :class="editor?.getText().trim()
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground'"
          :disabled="!editor?.getText().trim()"
          @click="handleSend(editor?.getHTML() || '', editor?.getText() || '')"
        >
          <Send :size="18" />
        </button>
      </div>
    </div>
  </div>
</template>

<style>
.rich-editor .tiptap {
  outline: none;
}
.rich-editor .tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--muted-foreground, #999);
  pointer-events: none;
  height: 0;
}
.rich-editor .mention {
  color: var(--primary, #3b82f6);
  font-weight: 500;
}
</style>

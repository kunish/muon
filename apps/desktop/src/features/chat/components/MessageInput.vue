<script setup lang="ts">
import { sendTextMessage } from '@matrix/index';
import { useSelector } from '@tanstack/vue-store';
import { Send } from 'lucide-vue-next';
import { useTyping } from '../composables/useTyping';
import { chatStore, getDraft, setDraft } from '../stores/chatStore';

const currentRoomId = useSelector(chatStore, (s) => s.currentRoomId);
const { t } = useI18n();
const { startTyping, stopTyping } = useTyping();
const text = ref('');
const textareaRef = ref<HTMLTextAreaElement>();

function adjustHeight() {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
}

async function send() {
  const roomId = currentRoomId.value;
  const msg = text.value.trim();
  if (!roomId || !msg) return;
  text.value = '';
  stopTyping();
  if (roomId) setDraft(roomId, '');
  if (textareaRef.value) textareaRef.value.style.height = 'auto';
  await sendTextMessage(roomId, msg);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}

function onInput() {
  adjustHeight();
  startTyping();
}

// 切换房间时保存草稿 & 恢复草稿
watch(
  () => currentRoomId.value,
  (newId, oldId) => {
    // 保存旧房间草稿
    if (oldId) {
      setDraft(oldId, text.value);
    }
    // 恢复新房间草稿
    text.value = newId ? getDraft(newId) : '';
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto';
      if (text.value) {
        requestAnimationFrame(adjustHeight);
      }
    }
  },
);
</script>

<template>
  <div class="border-t border-border px-4 py-3">
    <div class="flex items-end gap-2">
      <textarea
        ref="textareaRef"
        v-model="text"
        :rows="1"
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

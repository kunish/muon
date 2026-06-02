<script setup lang="ts">
import type { DocComment } from '../../types/doc';
import { getClient } from '@matrix/client';
import { Avatar } from '@muon/ui/avatar';
import { CheckCircle2, MessageSquare, X } from 'lucide-vue-next';
import { shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useContactList } from '@/shared/composables/useContactList';

defineProps<{
  comments: DocComment[];
  draftText: string;
}>();

const emit = defineEmits<{
  addComment: [text: string];
  resolve: [commentId: string];
  close: [];
}>();

const { locale } = useI18n();
const contactList = useContactList();

function displayName(userId: string): string {
  const contact = contactList.contacts.find((item) => item.userId === userId);
  if (contact) return contact.displayName;
  const profileName = getClient().getUser(userId)?.displayName;
  return profileName || userId.split(':')[0]?.replace(/^@/, '') || userId;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(locale.value, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const localDraft = shallowRef('');

function handleAdd(): void {
  const text = localDraft.value.trim();
  if (!text) return;
  emit('addComment', text);
  localDraft.value = '';
}
</script>

<template>
  <aside class="flex w-72 shrink-0 flex-col border-l border-border bg-sidebar">
    <div class="flex h-10 items-center justify-between border-b border-border px-3">
      <span class="text-xs font-semibold">评论</span>
      <button class="flex size-6 items-center justify-center rounded hover:bg-accent" @click="emit('close')">
        <X :size="14" />
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-3">
      <div v-if="comments.length === 0" class="py-8 text-center text-xs text-muted-foreground">暂无评论</div>
      <div
        v-for="comment in comments"
        :key="comment.id"
        class="mb-2 rounded-md border border-border bg-background p-2"
        :class="{ 'opacity-50': comment.resolved }"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="flex min-w-0 items-center gap-1.5">
            <Avatar :alt="displayName(comment.userId)" :color-id="comment.userId" size="xs" />
            <span class="truncate text-[11px] font-semibold">{{ displayName(comment.userId) }}</span>
            <span class="shrink-0 text-[10px] text-muted-foreground">{{ formatTime(comment.createdAt) }}</span>
          </span>
          <button
            v-if="!comment.resolved"
            class="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-green-600 dark:hover:text-green-400"
            @click="emit('resolve', comment.id)"
          >
            <CheckCircle2 :size="12" />
          </button>
        </div>
        <div class="mt-1">
          <span
            v-if="comment.selection"
            class="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
          >
            选区评论 {{ comment.selection.from }}-{{ comment.selection.to }}
          </span>
          <span v-else class="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            全文评论
          </span>
        </div>
        <p class="mt-1 text-[12px] leading-5">
          {{ comment.text }}
        </p>
      </div>
    </div>

    <div class="flex items-center gap-2 border-t border-border p-3">
      <input
        v-model="localDraft"
        type="text"
        placeholder="添加评论..."
        class="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
        @keyup.enter="handleAdd"
      />
      <button
        class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
        @click="handleAdd"
      >
        <MessageSquare :size="13" />
      </button>
    </div>
  </aside>
</template>

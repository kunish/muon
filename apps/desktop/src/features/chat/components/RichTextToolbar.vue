<script setup lang="ts">
import type { Editor } from '@tiptap/core';
import { Bold, Braces, Italic, Link2, List, ListOrdered, Quote, Strikethrough, Underline, X } from 'lucide-vue-next';

const props = defineProps<{
  editor: Editor | null;
  variant: 'compact' | 'expanded';
}>();

const { t } = useI18n();

const showLinkEditor = ref(false);
const linkUrl = ref('');

function toggleLinkEditor() {
  if (!props.editor) return;
  linkUrl.value = (props.editor.getAttributes('link').href as string | undefined) || '';
  showLinkEditor.value = !showLinkEditor.value;
}

function applyLink() {
  if (!props.editor) return;
  const nextHref = linkUrl.value.trim();
  if (!nextHref) {
    props.editor.chain().focus().extendMarkRange('link').unsetLink().run();
    showLinkEditor.value = false;
    return;
  }
  props.editor.chain().focus().extendMarkRange('link').setLink({ href: nextHref }).run();
  showLinkEditor.value = false;
}

function closeLinkEditor() {
  showLinkEditor.value = false;
}
</script>

<template>
  <template v-if="editor">
    <!-- Compact variant: ordering Bold, Italic, Underline, Strikethrough, Code | sep | BulletList, OrderedList, Blockquote, Link -->
    <template v-if="variant === 'compact'">
      <button
        class="cursor-pointer rounded p-1 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground"
        :class="editor.isActive('bold') && 'bg-primary text-primary-foreground hover:opacity-90'"
        :title="t('chat.format_bold')"
        @click="editor.chain().focus().toggleBold().run()"
      >
        <Bold :size="14" />
      </button>
      <button
        class="cursor-pointer rounded p-1 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground"
        :class="editor.isActive('italic') && 'bg-primary text-primary-foreground hover:opacity-90'"
        :title="t('chat.format_italic')"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <Italic :size="14" />
      </button>
      <button
        class="cursor-pointer rounded p-1 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground"
        :class="editor.isActive('underline') && 'bg-primary text-primary-foreground hover:opacity-90'"
        :title="t('chat.format_underline')"
        @click="editor.chain().focus().toggleUnderline().run()"
      >
        <Underline :size="14" />
      </button>
      <button
        class="cursor-pointer rounded p-1 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground"
        :class="editor.isActive('strike') && 'bg-primary text-primary-foreground hover:opacity-90'"
        :title="t('chat.format_strike')"
        @click="editor.chain().focus().toggleStrike().run()"
      >
        <Strikethrough :size="14" />
      </button>
      <button
        class="cursor-pointer rounded p-1 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground"
        :class="editor.isActive('code') && 'bg-primary text-primary-foreground hover:opacity-90'"
        :title="t('chat.format_code')"
        @click="editor.chain().focus().toggleCode().run()"
      >
        <Braces :size="14" />
      </button>
      <div class="w-px h-4 bg-border/60 mx-0.5" />
      <button
        class="cursor-pointer rounded p-1 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground"
        :class="editor.isActive('bulletList') && 'bg-primary text-primary-foreground hover:opacity-90'"
        :title="t('chat.format_ul')"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        <List :size="14" />
      </button>
      <button
        class="cursor-pointer rounded p-1 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground"
        :class="editor.isActive('orderedList') && 'bg-primary text-primary-foreground hover:opacity-90'"
        :title="t('chat.format_ol')"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        <ListOrdered :size="14" />
      </button>
      <button
        class="cursor-pointer rounded p-1 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground"
        :class="editor.isActive('blockquote') && 'bg-primary text-primary-foreground hover:opacity-90'"
        :title="t('chat.format_quote')"
        @click="editor.chain().focus().toggleBlockquote().run()"
      >
        <Quote :size="14" />
      </button>
      <button
        class="cursor-pointer rounded p-1 text-muted-foreground transition-all duration-[120ms] hover:bg-accent hover:text-foreground"
        :class="editor.isActive('link') && 'bg-primary text-primary-foreground hover:opacity-90'"
        :title="t('chat.format_link')"
        @click="toggleLinkEditor"
      >
        <Link2 :size="14" />
      </button>
    </template>

    <!-- Expanded variant: ordering Bold, Strikethrough, Italic, Underline, OrderedList, BulletList, Blockquote, Link, Code -->
    <template v-else>
      <button
        class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
        :class="editor.isActive('bold') && 'bg-primary text-primary-foreground hover:opacity-90'"
        :title="t('chat.format_bold')"
        @click="editor.chain().focus().toggleBold().run()"
      >
        <Bold :size="17" />
      </button>
      <button
        class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
        :class="editor.isActive('strike') && 'bg-primary text-primary-foreground hover:opacity-90'"
        :title="t('chat.format_strike')"
        @click="editor.chain().focus().toggleStrike().run()"
      >
        <Strikethrough :size="17" />
      </button>
      <button
        class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
        :class="editor.isActive('italic') && 'bg-primary text-primary-foreground hover:opacity-90'"
        :title="t('chat.format_italic')"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <Italic :size="17" />
      </button>
      <button
        class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
        :class="editor.isActive('underline') && 'bg-primary text-primary-foreground hover:opacity-90'"
        :title="t('chat.format_underline')"
        @click="editor.chain().focus().toggleUnderline().run()"
      >
        <Underline :size="17" />
      </button>
      <button
        class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
        :class="editor.isActive('orderedList') && 'bg-primary text-primary-foreground hover:opacity-90'"
        :title="t('chat.format_ol')"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        <ListOrdered :size="17" />
      </button>
      <button
        class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
        :class="editor.isActive('bulletList') && 'bg-primary text-primary-foreground hover:opacity-90'"
        :title="t('chat.format_ul')"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        <List :size="17" />
      </button>
      <button
        class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
        :class="editor.isActive('blockquote') && 'bg-primary text-primary-foreground hover:opacity-90'"
        :title="t('chat.format_quote')"
        @click="editor.chain().focus().toggleBlockquote().run()"
      >
        <Quote :size="17" />
      </button>
      <button
        class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
        :class="editor.isActive('link') && 'bg-primary text-primary-foreground hover:opacity-90'"
        :title="t('chat.format_link')"
        @click="toggleLinkEditor"
      >
        <Link2 :size="17" />
      </button>
    </template>

    <!-- Link editor form (shared between both variants) -->
    <form
      v-if="showLinkEditor"
      class="ml-1 flex h-8 items-center gap-0.5 rounded-md border border-border/60 bg-background px-1"
      @submit.prevent="applyLink"
    >
      <input
        v-model="linkUrl"
        class="h-6 bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground"
        :class="variant === 'compact' ? 'w-40' : 'w-44'"
        :placeholder="t('chat.format_link_prompt')"
        @keydown.stop
      />
      <button type="submit" class="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent">
        <Link2 :size="13" />
      </button>
      <button
        type="button"
        class="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
        @click="closeLinkEditor"
      >
        <X :size="13" />
      </button>
    </form>

    <!-- Code button only in expanded variant (appears after link editor) -->
    <button
      v-if="variant === 'expanded'"
      class="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
      :class="editor.isActive('code') && 'bg-primary text-primary-foreground hover:opacity-90'"
      :title="t('chat.format_code')"
      @click="editor.chain().focus().toggleCode().run()"
    >
      <Braces :size="17" />
    </button>
  </template>
</template>

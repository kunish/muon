<script setup lang="ts">
import type { Editor } from '@tiptap/core'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Code2, Heading1, Heading2, Heading3,
  Image as ImageIcon, Table, Undo2, Redo2,
} from 'lucide-vue-next'

defineProps<{ editor: Editor | null }>()
const emit = defineEmits<{ insertImage: [] }>()
</script>

<template>
  <div class="flex h-10 shrink-0 items-center gap-1 border-b border-border bg-sidebar px-3">
    <button
      v-for="action in [
        { label: 'bold', icon: Bold, action: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive('bold') },
        { label: 'italic', icon: Italic, action: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive('italic') },
        { label: 'underline', icon: UnderlineIcon, action: () => editor?.chain().focus().toggleUnderline().run(), active: editor?.isActive('underline') },
        { label: 'strikethrough', icon: Strikethrough, action: () => editor?.chain().focus().toggleStrike().run(), active: editor?.isActive('strike') },
        { label: 'heading1', icon: Heading1, action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), active: editor?.isActive('heading', { level: 1 }) },
        { label: 'heading2', icon: Heading2, action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), active: editor?.isActive('heading', { level: 2 }) },
        { label: 'heading3', icon: Heading3, action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), active: editor?.isActive('heading', { level: 3 }) },
        { label: 'bulletList', icon: List, action: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive('bulletList') },
        { label: 'orderedList', icon: ListOrdered, action: () => editor?.chain().focus().toggleOrderedList().run(), active: editor?.isActive('orderedList') },
        { label: 'blockquote', icon: Quote, action: () => editor?.chain().focus().toggleBlockquote().run(), active: editor?.isActive('blockquote') },
        { label: 'codeBlock', icon: Code2, action: () => editor?.chain().focus().toggleCodeBlock().run(), active: editor?.isActive('codeBlock') },
        { label: 'insertTable', icon: Table, action: () => (editor?.chain().focus() as any).insertTable({ rows: 3, cols: 3, withHeaderRow: true })?.run(), active: false },
        { label: 'undo', icon: Undo2, action: () => editor?.chain().focus().undo().run(), active: false },
        { label: 'redo', icon: Redo2, action: () => editor?.chain().focus().redo().run(), active: false },
      ]"
      :key="action.label"
      class="flex size-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      :class="{ 'bg-accent text-primary': action.active }"
      @click="action.action"
    >
      <component :is="action.icon" :size="16" />
    </button>

    <div class="ml-auto flex items-center gap-1">
      <button
        class="flex size-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        @click="emit('insertImage')"
      >
        <ImageIcon :size="16" />
      </button>
    </div>
  </div>
</template>

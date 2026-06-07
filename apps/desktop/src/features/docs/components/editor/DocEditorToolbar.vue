<script setup lang="ts">
import type { Editor } from '@tiptap/core';
import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Table,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-vue-next';
import { DEFAULT_DOC_CODE_LANGUAGE } from '../../lib/codeBlockLanguages';

const props = defineProps<{ editor: Editor | null }>();
const emit = defineEmits<{ insertImage: [] }>();

const toolbarRevision = shallowRef(0);

watch(
  () => props.editor,
  (editor, _previousEditor, onCleanup) => {
    if (!editor) return;

    const bumpToolbarState = (): void => {
      toolbarRevision.value += 1;
    };

    editor.on('selectionUpdate', bumpToolbarState);
    editor.on('transaction', bumpToolbarState);
    bumpToolbarState();

    onCleanup(() => {
      editor.off('selectionUpdate', bumpToolbarState);
      editor.off('transaction', bumpToolbarState);
    });
  },
  { immediate: true },
);

function canRun(command: () => boolean): boolean {
  try {
    return command();
  } catch {
    return false;
  }
}

const formattingActions = computed(() => {
  const editor = props.editor;
  const editorReady = toolbarRevision.value >= 0 && !!editor;

  return [
    {
      label: 'bold',
      title: '加粗',
      icon: Bold,
      action: () => editor?.chain().focus().toggleBold().run(),
      active: !!editor?.isActive('bold'),
      disabled: !editorReady,
    },
    {
      label: 'italic',
      title: '斜体',
      icon: Italic,
      action: () => editor?.chain().focus().toggleItalic().run(),
      active: !!editor?.isActive('italic'),
      disabled: !editorReady,
    },
    {
      label: 'underline',
      title: '下划线',
      icon: UnderlineIcon,
      action: () => editor?.chain().focus().toggleUnderline().run(),
      active: !!editor?.isActive('underline'),
      disabled: !editorReady,
    },
    {
      label: 'strikethrough',
      title: '删除线',
      icon: Strikethrough,
      action: () => editor?.chain().focus().toggleStrike().run(),
      active: !!editor?.isActive('strike'),
      disabled: !editorReady,
    },
    {
      label: 'heading1',
      title: '一级标题',
      icon: Heading1,
      action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
      active: !!editor?.isActive('heading', { level: 1 }),
      disabled: !editorReady,
    },
    {
      label: 'heading2',
      title: '二级标题',
      icon: Heading2,
      action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
      active: !!editor?.isActive('heading', { level: 2 }),
      disabled: !editorReady,
    },
    {
      label: 'heading3',
      title: '三级标题',
      icon: Heading3,
      action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
      active: !!editor?.isActive('heading', { level: 3 }),
      disabled: !editorReady,
    },
    {
      label: 'bulletList',
      title: '无序列表',
      icon: List,
      action: () => editor?.chain().focus().toggleBulletList().run(),
      active: !!editor?.isActive('bulletList'),
      disabled: !editorReady,
    },
    {
      label: 'orderedList',
      title: '有序列表',
      icon: ListOrdered,
      action: () => editor?.chain().focus().toggleOrderedList().run(),
      active: !!editor?.isActive('orderedList'),
      disabled: !editorReady,
    },
    {
      label: 'blockquote',
      title: '引用',
      icon: Quote,
      action: () => editor?.chain().focus().toggleBlockquote().run(),
      active: !!editor?.isActive('blockquote'),
      disabled: !editorReady,
    },
    {
      label: 'codeBlock',
      title: '代码块',
      icon: Code2,
      action: () => {
        if (!editor) return;
        if (editor.isActive('codeBlock')) {
          editor.chain().focus().toggleCodeBlock().run();
          return;
        }
        editor.chain().focus().setCodeBlock({ language: DEFAULT_DOC_CODE_LANGUAGE }).run();
      },
      active: !!editor?.isActive('codeBlock'),
      disabled: !editorReady,
    },
    {
      label: 'insertTable',
      title: '插入表格',
      icon: Table,
      action: () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      active: false,
      disabled: !editorReady,
    },
    {
      label: 'undo',
      title: '撤销',
      icon: Undo2,
      action: () => editor?.chain().focus().undo().run(),
      active: false,
      disabled: !editorReady || !canRun(() => editor.can().chain().focus().undo().run()),
    },
    {
      label: 'redo',
      title: '重做',
      icon: Redo2,
      action: () => editor?.chain().focus().redo().run(),
      active: false,
      disabled: !editorReady || !canRun(() => editor.can().chain().focus().redo().run()),
    },
  ];
});

function runAction(action: { action: () => unknown; disabled: boolean }): void {
  if (action.disabled) return;

  action.action();
}
</script>

<template>
  <div
    class="flex h-11 shrink-0 items-center gap-1 border-b border-border bg-sidebar px-4"
    role="toolbar"
    aria-label="文档格式工具栏"
  >
    <button
      v-for="action in formattingActions"
      :key="action.label"
      type="button"
      class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      :class="{ 'bg-accent text-primary': action.active }"
      :title="action.title"
      :aria-label="action.title"
      :aria-pressed="action.active"
      :disabled="action.disabled"
      @click="runAction(action)"
    >
      <component :is="action.icon" :size="16" />
    </button>

    <div class="ml-auto flex items-center gap-1">
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        title="插入图片"
        aria-label="插入图片"
        :disabled="!editor"
        @click="emit('insertImage')"
      >
        <ImageIcon :size="16" />
      </button>
    </div>
  </div>
</template>

import type { Doc } from 'yjs'
import { type Ref, shallowRef, onMounted, onUnmounted } from 'vue'
import { Editor, type Editor as EditorType } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { Collaboration } from '@tiptap/extension-collaboration'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { Image } from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { Underline } from '@tiptap/extension-underline'
import { Placeholder } from '@tiptap/extension-placeholder'

export function useDocEditor(
  ydoc: () => Doc,
  elementRef: Ref<HTMLElement | undefined>,
  user: { id: string, name: string, color: string },
) {
  const editor = shallowRef<EditorType | null>(null)

  onMounted(() => {
    editor.value = new Editor({
      element: elementRef.value,
      extensions: [
        StarterKit.configure({
          undoRedo: false, // Yjs manages undo/redo history
        }),
        Collaboration.configure({
          fragment: ydoc().getXmlFragment('content'),
        }),
        Image.configure({ inline: true }),
        Link.configure({ openOnClick: false }),
        Underline,
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        Placeholder.configure({ placeholder: '输入文档内容...' }),
      ],
    })
  })

  onUnmounted(() => {
    editor.value?.destroy()
  })

  return { editor }
}

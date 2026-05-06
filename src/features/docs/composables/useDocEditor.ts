import type { Editor as EditorType } from '@tiptap/core'
import type { Ref } from 'vue'
import type { Doc } from 'yjs'
import { Editor } from '@tiptap/core'
import { Collaboration } from '@tiptap/extension-collaboration'
import { Image } from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { Underline } from '@tiptap/extension-underline'
import { StarterKit } from '@tiptap/starter-kit'
import { onMounted, onUnmounted, shallowRef } from 'vue'

export function useDocEditor(
  ydoc: () => Doc,
  elementRef: Ref<HTMLElement | undefined>,
  _user: { id: string, name: string, color: string },
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

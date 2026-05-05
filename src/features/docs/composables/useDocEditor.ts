import type { Doc } from 'yjs'
import { type Ref, type ShallowRef, onUnmounted } from 'vue'
import { useEditor, type Editor } from '@tiptap/vue-3'
import { StarterKit } from '@tiptap/starter-kit'
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor'
import { Image } from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { Underline } from '@tiptap/extension-underline'
import { Placeholder } from '@tiptap/extension-placeholder'

export function useDocEditor(
  ydoc: () => Doc,
  elementRef: Ref<HTMLElement | undefined>,
  user: { id: string, name: string, color: string },
) {
  const editor = useEditor({
    element: elementRef.value,
    extensions: [
      StarterKit.configure({
        undoRedo: false, // Yjs manages undo/redo history
      }),
      Collaboration.configure({
        fragment: ydoc().getXmlFragment('content'),
      }),
      CollaborationCursor.configure({
        provider: null,
        user: { name: user.name, color: user.color },
      }),
      Image.configure({ inline: true }),
      Link.configure({ openOnClick: false }),
      Underline,
      Placeholder.configure({ placeholder: '输入文档内容...' }),
    ],
  })

  onUnmounted(() => {
    editor.value?.destroy()
  })

  return { editor: editor as ShallowRef<Editor | null> }
}

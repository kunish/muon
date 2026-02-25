import Image from '@tiptap/extension-image'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { useEditor as useTiptapEditor } from '@tiptap/vue-3'

export function useEditor(options: {
  placeholder?: string
  onSubmit: (html: string, text: string) => void
}) {
  const editor = useTiptapEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: options.placeholder || '输入消息...',
      }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
      }),
      Image,
    ],
    editorProps: {
      handleKeyDown(view, event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          const html = view.dom.innerHTML
          const text = view.state.doc.textContent
          if (text.trim())
            options.onSubmit(html, text)
          return true
        }
        return false
      },
    },
  })

  function clear() {
    editor.value?.commands.clearContent()
  }

  function insertEmoji(emoji: string) {
    editor.value?.commands.insertContent(emoji)
    editor.value?.commands.focus()
  }

  return { editor, clear, insertEmoji }
}

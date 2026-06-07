import type { Editor as EditorType } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'
import type { Doc } from 'yjs'
import { Editor } from '@tiptap/core'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Collaboration } from '@tiptap/extension-collaboration'
import { Image } from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { Underline } from '@tiptap/extension-underline'
import { StarterKit } from '@tiptap/starter-kit'
import { common, createLowlight } from 'lowlight'
import { DEFAULT_DOC_CODE_LANGUAGE } from '../lib/codeBlockLanguages'
import { createDocCodeBlockNodeView } from '../lib/codeBlockNodeView'

const lowlight = createLowlight(common)
const DocCodeBlockLowlight = CodeBlockLowlight.extend({
  addNodeView() {
    return createDocCodeBlockNodeView
  },
})

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Failed to read image file'))
    }
    reader.readAsDataURL(file)
  })
}

function isSelectionInEmptyListItem(view: EditorView): boolean {
  const { selection } = view.state
  if (!selection.empty) return false

  for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
    const node = selection.$from.node(depth)
    if (node.type.name === 'listItem') return node.textContent.trim().length === 0
  }

  return false
}

export function useDocEditor(
  ydoc: () => Doc,
  elementRef: Ref<HTMLElement | undefined>,
  _user: { id: string; name: string; color: string },
  editable?: Ref<boolean>,
) {
  const editor = shallowRef<EditorType | null>(null)

  onMounted(() => {
    editor.value = new Editor({
      element: elementRef.value,
      editable: editable?.value ?? true,
      extensions: [
        StarterKit.configure({
          codeBlock: false,
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
        DocCodeBlockLowlight.configure({
          lowlight,
          defaultLanguage: DEFAULT_DOC_CODE_LANGUAGE,
          enableTabIndentation: true,
          tabSize: 2,
          HTMLAttributes: {
            class: 'doc-code-block',
          },
        }),
        Placeholder.configure({ placeholder: '输入文档内容...' }),
      ],
      editorProps: {
        attributes: {
          class: 'doc-editor-prosemirror',
          'aria-label': '文档正文',
        },
        handleKeyDown(view, event) {
          if (event.key !== 'Enter') return false

          if (!isSelectionInEmptyListItem(view)) return false

          const didLift = editor.value?.chain().focus().liftListItem('listItem').run()
          if (!didLift) return false

          event.preventDefault()
          return true
        },
        handlePaste(view, event) {
          const imageFiles = Array.from(event.clipboardData?.files ?? []).filter((file) =>
            file.type.startsWith('image/'),
          )

          if (imageFiles.length === 0) return false

          event.preventDefault()
          void Promise.all(imageFiles.map(readFileAsDataUrl)).then((sources) => {
            const { schema } = view.state
            const nodes = sources.map((src, index) =>
              schema.nodes.image.create({
                src,
                alt: imageFiles[index]?.name ?? 'image',
              }),
            )
            const transaction = view.state.tr.replaceSelectionWith(nodes[0])
            for (const node of nodes.slice(1)) {
              transaction.insert(transaction.selection.to, node)
            }
            view.dispatch(transaction.scrollIntoView())
          })
          return true
        },
      },
    })
  })

  if (editable) {
    watch(editable, (value) => {
      editor.value?.setEditable(value)
    })
  }

  onUnmounted(() => {
    editor.value?.destroy()
  })

  return { editor }
}

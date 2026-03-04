import Image from '@tiptap/extension-image'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { useEditor as useTiptapEditor } from '@tiptap/vue-3'

interface MentionItem {
  id: string
  label: string
  avatar?: string
}

export interface MentionPopupState {
  visible: boolean
  items: MentionItem[]
  selectedIndex: number
  clientRect: (() => DOMRect | null) | null
  command: ((item: { id: string, label: string }) => void) | null
}

export function useEditor(options: {
  placeholder?: string
  onSubmit: (html: string, text: string) => void
  mentionSearch?: (query: string) => MentionItem[]
  onMentionState?: (state: MentionPopupState) => void
}) {
  // 跟踪 mention popup 是否活跃，用于阻止 Enter 提交
  let mentionActive = false

  const editor = useTiptapEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: options.placeholder || '',
      }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        renderText({ node }) {
          return `@${node.attrs.label ?? node.attrs.id}`
        },
        suggestion: {
          items: ({ query }: { query: string }) => {
            return options.mentionSearch?.(query) ?? []
          },
          render: () => {
            let selectedIndex = 0
            let currentItems: MentionItem[] = []
            let currentCommand: ((item: { id: string, label: string }) => void) | null = null
            let lastClientRect: (() => DOMRect | null) | null = null

            function emitState(visible: boolean) {
              options.onMentionState?.({
                visible,
                items: currentItems,
                selectedIndex,
                clientRect: visible ? lastClientRect : null,
                command: currentCommand,
              })
            }

            return {
              onStart(props: any) {
                mentionActive = true
                selectedIndex = 0
                currentItems = props.items
                lastClientRect = props.clientRect ?? null
                currentCommand = (item: { id: string, label: string }) => {
                  props.command({ id: item.id, label: item.label })
                }
                emitState(true)
              },
              onUpdate(props: any) {
                selectedIndex = 0
                currentItems = props.items
                lastClientRect = props.clientRect ?? null
                currentCommand = (item: { id: string, label: string }) => {
                  props.command({ id: item.id, label: item.label })
                }
                emitState(true)
              },
              onKeyDown(props: any) {
                const { event } = props
                if (event.key === 'Escape') {
                  mentionActive = false
                  currentItems = []
                  currentCommand = null
                  emitState(false)
                  return true
                }
                if (event.key === 'ArrowDown') {
                  selectedIndex = currentItems.length
                    ? (selectedIndex + 1) % currentItems.length
                    : 0
                  emitState(true)
                  return true
                }
                if (event.key === 'ArrowUp') {
                  selectedIndex = currentItems.length
                    ? (selectedIndex - 1 + currentItems.length) % currentItems.length
                    : 0
                  emitState(true)
                  return true
                }
                if (event.key === 'Enter' || event.key === 'Tab') {
                  const item = currentItems[selectedIndex]
                  if (item && currentCommand) {
                    currentCommand({ id: item.id, label: item.label })
                  }
                  return true
                }
                return false
              },
              onExit() {
                mentionActive = false
                currentItems = []
                currentCommand = null
                selectedIndex = 0
                emitState(false)
              },
            }
          },
        },
      }),
      Image,
    ],
    editorProps: {
      handleKeyDown(_view, event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          // mention popup 打开时不拦截 Enter，让 suggestion 处理选择
          if (mentionActive)
            return false

          event.preventDefault()
          // 使用 TipTap 的 getHTML() 确保 mention 节点被正确序列化
          const html = editor.value?.getHTML() || ''
          const text = _view.state.doc.textContent
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

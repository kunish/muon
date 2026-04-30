import type { MaybeRefOrGetter } from 'vue'
import { mergeAttributes, Node } from '@tiptap/core'
import Link from '@tiptap/extension-link'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { useEditor as useTiptapEditor } from '@tiptap/vue-3'
import { toValue, watch } from 'vue'
import { renderMarkdownForMatrix } from '@/shared/lib/markdown'

interface MentionItem {
  id: string
  label: string
  avatar?: string
  isInCurrentRoom?: boolean
}

export interface MentionPopupState {
  visible: boolean
  items: MentionItem[]
  selectedIndex: number
  clientRect: (() => DOMRect | null) | null
  command: ((item: { id: string, label: string }) => void) | null
}

export interface PendingMediaAttachment {
  id: string
  file: File
  kind: 'image' | 'video' | 'file'
  previewUrl: string | null
}

interface PendingMediaOptions {
  getAttachment?: (id: string) => PendingMediaAttachment | undefined
  onPreview?: (attachment: PendingMediaAttachment) => void
  onRemove?: (id: string) => void
}

const PendingMedia = Node.create<PendingMediaOptions>({
  name: 'pendingMedia',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {}
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-pending-media-id'),
        renderHTML: attributes => ({
          'data-pending-media-id': attributes.id,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-pending-media-id]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ({ node, getPos, view }) => {
      const id = String(node.attrs.id || '')
      const attachment = this.options.getAttachment?.(id)
      const dom = document.createElement('div')
      dom.dataset.pendingMediaId = id
      dom.dataset.testid = 'pending-paste-attachment'
      dom.contentEditable = 'false'
      dom.className = 'my-1 flex w-fit max-w-[360px] items-center gap-2 rounded-md border border-border/70 bg-background p-1.5 text-xs text-foreground shadow-sm'

      const previewShell = document.createElement(attachment?.previewUrl ? 'button' : 'div')
      previewShell.className = 'flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded bg-muted'
      if (attachment?.previewUrl) {
        previewShell.setAttribute('type', 'button')
        previewShell.setAttribute('title', attachment.file.name || 'file')
        previewShell.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          this.options.onPreview?.(attachment)
        })
      }

      if (attachment?.previewUrl && attachment.kind === 'image') {
        const image = document.createElement('img')
        image.dataset.testid = 'pending-paste-image-preview'
        image.src = attachment.previewUrl
        image.alt = attachment.file.name || 'image'
        image.className = 'h-full w-full object-contain'
        previewShell.append(image)
      }
      else if (attachment?.previewUrl && attachment.kind === 'video') {
        const video = document.createElement('video')
        video.dataset.testid = 'pending-paste-video-preview'
        video.src = attachment.previewUrl
        video.className = 'h-full w-full object-contain'
        video.muted = true
        video.playsInline = true
        video.preload = 'metadata'
        previewShell.append(video)
      }
      else {
        const fallback = document.createElement('span')
        fallback.className = attachment?.kind === 'file' ? 'text-muted-foreground' : 'text-primary'
        fallback.textContent = attachment?.kind === 'video' ? 'VID' : attachment?.kind === 'image' ? 'IMG' : 'FILE'
        previewShell.append(fallback)
      }

      const meta = document.createElement('div')
      meta.className = 'min-w-0 flex-1'
      const name = document.createElement('div')
      name.className = 'truncate'
      name.title = attachment?.file.name || ''
      name.textContent = attachment?.file.name || 'file'
      const size = document.createElement('div')
      size.className = 'text-[11px] text-muted-foreground'
      size.textContent = attachment ? formatPendingFileSize(attachment.file.size) : ''
      meta.append(name, size)

      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground'
      remove.title = 'Delete'
      remove.textContent = 'x'
      remove.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        const position = typeof getPos === 'function' ? getPos() : null
        if (typeof position === 'number') {
          view.dispatch(view.state.tr.delete(position, position + node.nodeSize))
        }
        this.options.onRemove?.(id)
      })

      dom.append(previewShell, meta, remove)
      return { dom }
    }
  },
})

export function useEditor(options: {
  placeholder?: MaybeRefOrGetter<string>
  onSubmit: (html: string, text: string) => void
  onPasteFiles?: (files: File[]) => void | Promise<void>
  canSubmit?: MaybeRefOrGetter<boolean>
  pendingMedia?: PendingMediaOptions
  submitOnEnter?: MaybeRefOrGetter<boolean>
  mentionSearch?: (query: string) => MentionItem[]
  onMentionState?: (state: MentionPopupState) => void
}) {
  // 跟踪 mention popup 是否活跃，用于阻止 Enter 提交
  let mentionActive = false

  const editor = useTiptapEditor({
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
        heading: false,
        codeBlock: false,
      }),
      Underline,
      PendingMedia.configure(options.pendingMedia ?? {}),
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Placeholder.configure({
        placeholder: () => toValue(options.placeholder) || '',
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

            /** TipTap suggestion callback props — @tiptap/suggestion is not a direct dependency */
            interface SuggestionCallbackProps {
              items: MentionItem[]
              command: (item: { id: string, label: string }) => void
              clientRect?: (() => DOMRect | null) | null
            }

            return {
              onStart(props: SuggestionCallbackProps) {
                mentionActive = true
                selectedIndex = 0
                currentItems = props.items
                lastClientRect = props.clientRect ?? null
                currentCommand = (item: { id: string, label: string }) => {
                  props.command({ id: item.id, label: item.label })
                }
                emitState(true)
              },
              onUpdate(props: SuggestionCallbackProps) {
                selectedIndex = 0
                currentItems = props.items
                lastClientRect = props.clientRect ?? null
                currentCommand = (item: { id: string, label: string }) => {
                  props.command({ id: item.id, label: item.label })
                }
                emitState(true)
              },
              onKeyDown(props: { event: KeyboardEvent }) {
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
    ],
    editorProps: {
      handlePaste(_view, event) {
        const files = getClipboardFiles(event.clipboardData)
        if (files.length && options.onPasteFiles) {
          event.preventDefault()
          void options.onPasteFiles(files)
          return true
        }

        const text = event.clipboardData?.getData('text/plain') ?? ''
        const markdown = renderMarkdownForMatrix(text)
        if (!markdown)
          return false

        event.preventDefault()
        editor.value?.chain().focus().insertContent(markdown.formattedBody).run()
        return true
      },
      handleKeyDown(_view, event) {
        if (event.key === 'Enter' && !event.shiftKey && toValue(options.submitOnEnter) !== false) {
          // mention popup 打开时不拦截 Enter，让 suggestion 处理选择
          if (mentionActive)
            return false

          event.preventDefault()
          // 使用 TipTap 的 getHTML() 确保 mention 节点被正确序列化
          const html = editor.value?.getHTML() || ''
          const text = editor.value?.getText() || ''
          if (text.trim() || toValue(options.canSubmit))
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

  function insertPendingMediaAttachment(id: string) {
    editor.value?.chain().focus().insertContent([
      {
        type: 'pendingMedia',
        attrs: { id },
      },
      {
        type: 'paragraph',
      },
    ]).run()
  }

  // placeholder 响应式更新：当 getter/ref 变化时触发 TipTap 重新渲染
  watch(
    () => toValue(options.placeholder),
    () => {
      // Placeholder 使用函数模式，只需触发一次视图更新即可拿到新值
      editor.value?.view.dispatch(editor.value.state.tr)
    },
  )

  return { editor, clear, insertEmoji, insertPendingMediaAttachment }
}

function formatPendingFileSize(size: number): string {
  if (size < 1024)
    return `${size} B`
  if (size < 1024 * 1024)
    return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function getClipboardFiles(data: DataTransfer | null): File[] {
  const files = Array.from(data?.files ?? [])
  if (files.length)
    return files

  return Array.from(data?.items ?? [])
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter((file): file is File => Boolean(file))
}

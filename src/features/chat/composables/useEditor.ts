import type { JSONContent } from '@tiptap/core'
import type { MaybeRefOrGetter } from 'vue'
import { generateJSON, mergeAttributes, Node as TiptapNode } from '@tiptap/core'
import Link from '@tiptap/extension-link'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { useEditor as useTiptapEditor } from '@tiptap/vue-3'
import { toValue, watch } from 'vue'
import { sanitizeMatrixHtml } from '@/shared/lib/htmlSanitizer'
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

export interface PastedMediaSource {
  index: number
  src: string
  name: string
  kind: 'image' | 'video' | 'file'
}

interface PendingMediaOptions {
  getAttachment?: (id: string) => PendingMediaAttachment | undefined
  onPreview?: (attachment: PendingMediaAttachment) => void
  onRemove?: (id: string) => void
}

const PendingMedia = TiptapNode.create<PendingMediaOptions>({
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
  onPasteMediaSources?: (sources: PastedMediaSource[]) => string[] | Promise<string[]>
  canSubmit?: MaybeRefOrGetter<boolean>
  pendingMedia?: PendingMediaOptions
  submitOnEnter?: MaybeRefOrGetter<boolean>
  mentionSearch?: (query: string) => MentionItem[]
  onMentionState?: (state: MentionPopupState) => void
}) {
  // 跟踪 mention popup 是否活跃，用于阻止 Enter 提交
  let mentionActive = false

  const editorExtensions = [
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
  ]

  const editor = useTiptapEditor({
    extensions: editorExtensions,
    editorProps: {
      handlePaste(_view, event) {
        const files = getClipboardFiles(event.clipboardData)
        if (files.length && options.onPasteFiles) {
          event.preventDefault()
          void options.onPasteFiles(files)
          return true
        }

        const html = event.clipboardData?.getData('text/html') ?? ''
        const mediaSources = getClipboardHtmlMediaSources(html)
        if (mediaSources.length && options.onPasteMediaSources) {
          event.preventDefault()
          void Promise.resolve(options.onPasteMediaSources(mediaSources))
            .then((attachmentIds) => {
              if (attachmentIds.length) {
                insertHtmlWithPendingMedia(html, attachmentIds)
                return
              }
              insertHtmlWithoutMedia(html)
            })
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

  function insertHtmlWithoutMedia(html: string) {
    const strippedHtml = stripMediaElementsFromHtml(html)
    const safeHtml = sanitizeMatrixHtml(strippedHtml)
    if (!safeHtml)
      return
    editor.value?.chain().focus().insertContent(safeHtml).run()
  }

  function insertHtmlWithPendingMedia(html: string, attachmentIds: string[]) {
    const fragments = createPasteInsertFragments(html, attachmentIds)
    if (!fragments.length)
      return
    if (!editor.value)
      return
    const content: JSONContent[] = []
    for (const fragment of fragments) {
      if (fragment.type === 'html') {
        content.push(...htmlFragmentToContent(fragment.html))
        continue
      }
      content.push({
        type: 'pendingMedia',
        attrs: { id: fragment.id },
      })
    }
    if (content.length)
      editor.value.chain().focus().insertContent(content).run()
  }

  function htmlFragmentToContent(html: string): JSONContent[] {
    const json = generateJSON(html, editorExtensions)
    return Array.isArray(json.content) ? json.content : []
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

const MEDIA_SELECTOR = 'img, video, audio, source, picture, canvas, iframe, object, embed'
const EMPTY_BLOCK_SELECTOR = 'p, div, span, figure'

function getClipboardHtmlMediaSources(html: string): PastedMediaSource[] {
  if (!html || typeof DOMParser === 'undefined')
    return []

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const sources: PastedMediaSource[] = []
  for (const [index, image] of Array.from(doc.body.querySelectorAll<HTMLImageElement>('img[src]')).entries()) {
    const src = image.getAttribute('data-rich-media-mxc-src')?.trim()
      || image.getAttribute('src')?.trim()
      || ''
    if (!src)
      continue
    sources.push({
      index,
      src,
      name: getPastedMediaName(image, src),
      kind: 'image',
    })
  }
  return sources
}

function getPastedMediaName(image: HTMLImageElement, src: string): string {
  const name = image.getAttribute('alt')?.trim()
    || image.getAttribute('title')?.trim()
    || getFileNameFromUrl(src)
    || 'image.png'

  return name.includes('.') ? name : `${name}.png`
}

function getFileNameFromUrl(src: string): string {
  try {
    if (src.startsWith('data:'))
      return ''

    const url = new URL(src, window.location.href)
    return decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? '')
  }
  catch {
    return ''
  }
}

function stripMediaElementsFromHtml(html: string): string {
  if (!html || typeof DOMParser === 'undefined')
    return ''

  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.body.querySelectorAll(MEDIA_SELECTOR).forEach(element => element.remove())
  pruneEmptyElements(doc.body)
  return doc.body.innerHTML.trim()
}

type PasteInsertFragment
  = | { type: 'html', html: string }
    | { type: 'media', id: string }

function createPasteInsertFragments(html: string, attachmentIds: string[]): PasteInsertFragment[] {
  if (!html || typeof DOMParser === 'undefined')
    return []

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const fragments: PasteInsertFragment[] = []
  let mediaIndex = 0

  for (const node of Array.from(doc.body.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      if (isMediaOnlyBlock(element)) {
        const attachmentId = attachmentIds[mediaIndex++]
        if (attachmentId)
          fragments.push({ type: 'media', id: attachmentId })
        continue
      }

      const clonedElement = element.cloneNode(true) as Element
      clonedElement.querySelectorAll(MEDIA_SELECTOR).forEach((mediaElement) => {
        const attachmentId = attachmentIds[mediaIndex++]
        if (attachmentId)
          fragments.push({ type: 'media', id: attachmentId })
        mediaElement.remove()
      })
      pruneEmptyElements(clonedElement)
      const safeHtml = sanitizeMatrixHtml(clonedElement.outerHTML.trim())
      if (safeHtml)
        fragments.push({ type: 'html', html: safeHtml })
      continue
    }

    const text = node.textContent?.trim()
    if (text)
      fragments.push({ type: 'html', html: text })
  }
  return fragments
}

function isMediaOnlyBlock(element: Element): boolean {
  if (!['p', 'figure'].includes(element.tagName.toLowerCase()))
    return false

  return Array.from(element.childNodes).every((node) => {
    if (node.nodeType === Node.TEXT_NODE)
      return !(node.textContent ?? '').trim()
    if (node.nodeType !== Node.ELEMENT_NODE)
      return false
    return (node as Element).matches(MEDIA_SELECTOR)
  })
}

function pruneEmptyElements(root: ParentNode) {
  let removed = false
  do {
    removed = false
    root.querySelectorAll(EMPTY_BLOCK_SELECTOR).forEach((element) => {
      if (element.hasAttribute('data-pending-media-id'))
        return
      if (element.textContent?.trim())
        return
      if (element.querySelector('a[href], br'))
        return
      element.remove()
      removed = true
    })
  } while (removed)
}

import type { NodeViewRendererProps } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { NodeView } from '@tiptap/pm/view'
import {
  DOC_CODE_LANGUAGE_OPTIONS,
  normalizeDocCodeLanguage,
} from './codeBlockLanguages'

const TOOLBAR_EVENTS = ['pointerdown', 'mousedown', 'click', 'keydown'] as const

function stopToolbarEvent(event: Event): void {
  event.stopPropagation()
}

function isToolbarEvent(event: Event): boolean {
  const target = event.target
  return typeof Element !== 'undefined'
    && target instanceof Element
    && target.closest('.doc-code-block-toolbar') !== null
}

function createLanguageSelect(language: string): HTMLSelectElement {
  const select = document.createElement('select')
  select.className = 'doc-code-language-select'
  select.setAttribute('data-testid', 'doc-code-block-language-select')
  select.setAttribute('aria-label', '语法高亮语言')

  DOC_CODE_LANGUAGE_OPTIONS.forEach((option) => {
    const item = document.createElement('option')
    item.value = option.value
    item.textContent = option.label
    select.append(item)
  })

  select.value = language

  TOOLBAR_EVENTS.forEach((eventName) => {
    select.addEventListener(eventName, stopToolbarEvent)
  })

  return select
}

export function createDocCodeBlockNodeView(props: NodeViewRendererProps): NodeView {
  let currentNode = props.node
  const dom = document.createElement('div')
  const toolbar = document.createElement('div')
  const control = document.createElement('label')
  const icon = document.createElement('span')
  const pre = document.createElement('pre')
  const contentDOM = document.createElement('code')
  const select = createLanguageSelect(normalizeDocCodeLanguage(currentNode.attrs.language))

  dom.className = 'doc-code-block-view'
  dom.dataset.language = select.value

  toolbar.className = 'doc-code-block-toolbar'
  toolbar.contentEditable = 'false'
  TOOLBAR_EVENTS.forEach((eventName) => {
    toolbar.addEventListener(eventName, stopToolbarEvent)
  })

  control.className = 'doc-code-language-control'
  icon.className = 'doc-code-language-icon'
  icon.textContent = '</>'

  control.append(icon, select)
  toolbar.append(control)
  pre.append(contentDOM)
  dom.append(toolbar, pre)

  select.addEventListener('change', (event) => {
    event.stopPropagation()

    const language = normalizeDocCodeLanguage(select.value)
    const pos = props.getPos()
    const didUpdate = typeof pos === 'number'
      ? props.editor.chain().focus(pos + 1).updateAttributes('codeBlock', { language }).run()
      : false

    if (didUpdate)
      return

    if (typeof pos !== 'number')
      return

    props.view.dispatch(
      props.view.state.tr.setNodeMarkup(pos, undefined, {
        ...currentNode.attrs,
        language,
      }),
    )
  })

  return {
    dom,
    contentDOM,
    update(node: ProseMirrorNode) {
      if (node.type !== currentNode.type)
        return false

      currentNode = node
      const language = normalizeDocCodeLanguage(node.attrs.language)
      select.value = language
      dom.dataset.language = language
      return true
    },
    stopEvent: isToolbarEvent,
    ignoreMutation(mutation) {
      return mutation.target !== contentDOM && !contentDOM.contains(mutation.target)
    },
  }
}

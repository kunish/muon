import type { NodeViewRendererProps } from '@tiptap/core'
import { Editor } from '@tiptap/core'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { StarterKit } from '@tiptap/starter-kit'
import { common, createLowlight } from 'lowlight'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_DOC_CODE_LANGUAGE } from '@/features/docs/lib/codeBlockLanguages'
import { createDocCodeBlockNodeView } from '@/features/docs/lib/codeBlockNodeView'

function createNodeViewProps(
  options: {
    language?: string
    getPos?: () => number | undefined
    run?: () => boolean
  } = {},
) {
  const nodeType = { name: 'codeBlock' }
  const chain = {
    focus: vi.fn(() => chain),
    updateAttributes: vi.fn(() => chain),
    run: vi.fn(options.run ?? (() => true)),
  }
  const state = {
    tr: {
      setNodeMarkup: vi.fn(() => state.tr),
    },
  }

  return {
    props: {
      editor: {
        chain: vi.fn(() => chain),
      },
      node: {
        type: nodeType,
        attrs: {
          language: options.language ?? 'typescript',
        },
      },
      view: {
        state,
        dispatch: vi.fn(),
      },
      getPos: vi.fn(options.getPos ?? (() => 8)),
      decorations: [],
      innerDecorations: {},
      extension: {},
      HTMLAttributes: {},
    } as unknown as NodeViewRendererProps,
    chain,
    state,
    nodeType,
  }
}

describe('doc code block node view', () => {
  it('shows the language switcher when the editor mounts to a plain element', () => {
    const lowlight = createLowlight(common)
    const DocCodeBlockLowlight = CodeBlockLowlight.extend({
      addNodeView() {
        return createDocCodeBlockNodeView
      },
    })
    const element = document.createElement('div')
    const editor = new Editor({
      element,
      extensions: [
        StarterKit.configure({ codeBlock: false }),
        DocCodeBlockLowlight.configure({
          lowlight,
          defaultLanguage: DEFAULT_DOC_CODE_LANGUAGE,
        }),
      ],
      content: {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: 'console.log("hello world")' }],
          },
        ],
      },
    })

    const select = element.querySelector('[data-testid="doc-code-block-language-select"]') as HTMLSelectElement

    expect(select).toBeInstanceOf(HTMLSelectElement)
    expect(select.value).toBe('javascript')
    expect(element.querySelector('.doc-code-block-view')).toBeInstanceOf(HTMLDivElement)

    editor.destroy()
  })

  it('renders a language switcher in plain editor mounts', () => {
    const { props } = createNodeViewProps()
    const nodeView = createDocCodeBlockNodeView(props)
    const select = nodeView.dom.querySelector('[data-testid="doc-code-block-language-select"]') as HTMLSelectElement

    expect(select).toBeInstanceOf(HTMLSelectElement)
    expect(select.value).toBe('typescript')
    expect(nodeView.dom.querySelector('.doc-code-block-toolbar')).toBeInstanceOf(HTMLDivElement)
    expect(nodeView.contentDOM?.tagName).toBe('CODE')
  })

  it('moves selection into the code block before changing language', () => {
    const { props, chain } = createNodeViewProps()
    const nodeView = createDocCodeBlockNodeView(props)
    const select = nodeView.dom.querySelector('[data-testid="doc-code-block-language-select"]') as HTMLSelectElement

    select.value = 'python'
    select.dispatchEvent(new Event('change', { bubbles: true }))

    expect(chain.focus).toHaveBeenCalledWith(9)
    expect(chain.updateAttributes).toHaveBeenCalledWith('codeBlock', { language: 'python' })
    expect(chain.run).toHaveBeenCalled()
    expect(props.view.dispatch).not.toHaveBeenCalled()
  })

  it('falls back to direct node markup when command chaining cannot update', () => {
    const { props, state } = createNodeViewProps({ run: () => false })
    const nodeView = createDocCodeBlockNodeView(props)
    const select = nodeView.dom.querySelector('[data-testid="doc-code-block-language-select"]') as HTMLSelectElement

    select.value = 'go'
    select.dispatchEvent(new Event('change', { bubbles: true }))

    expect(state.tr.setNodeMarkup).toHaveBeenCalledWith(8, undefined, {
      language: 'go',
    })
    expect(props.view.dispatch).toHaveBeenCalledWith(state.tr)
  })

  it('keeps the selected language in sync when the document node updates', () => {
    const { props, nodeType } = createNodeViewProps()
    const nodeView = createDocCodeBlockNodeView(props)
    const select = nodeView.dom.querySelector('[data-testid="doc-code-block-language-select"]') as HTMLSelectElement

    expect(nodeView.update?.({ type: nodeType, attrs: { language: 'rust' } } as never)).toBe(true)
    expect(select.value).toBe('rust')
    expect((nodeView.dom as HTMLElement).dataset.language).toBe('rust')
  })
})

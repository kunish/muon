import type { Editor } from '@tiptap/core'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import DocEditorToolbar from '@/features/docs/components/editor/DocEditorToolbar.vue'

function createEditorMock(): Editor {
  const run = vi.fn(() => true)
  const chainValue = {
    focus: vi.fn(() => chainValue),
    toggleBold: vi.fn(() => chainValue),
    toggleItalic: vi.fn(() => chainValue),
    toggleUnderline: vi.fn(() => chainValue),
    toggleStrike: vi.fn(() => chainValue),
    toggleHeading: vi.fn(() => chainValue),
    toggleBulletList: vi.fn(() => chainValue),
    toggleOrderedList: vi.fn(() => chainValue),
    toggleBlockquote: vi.fn(() => chainValue),
    toggleCodeBlock: vi.fn(() => chainValue),
    setCodeBlock: vi.fn(() => chainValue),
    insertTable: vi.fn(() => chainValue),
    undo: vi.fn(() => chainValue),
    redo: vi.fn(() => chainValue),
    run,
  }
  const editor = {
    chain: vi.fn(() => chainValue),
    can: vi.fn(() => ({ chain: () => chainValue })),
    isActive: vi.fn(() => false),
    getAttributes: vi.fn(() => ({ language: 'typescript' })),
    on: vi.fn(),
    off: vi.fn(),
  }
  return editor as unknown as Editor
}

describe('docEditorToolbar', () => {
  it('disables formatting actions until the editor is ready', () => {
    const wrapper = mount(DocEditorToolbar, {
      props: { editor: null },
    })

    expect(wrapper.get('button[aria-label="加粗"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[aria-label="插入图片"]').attributes('disabled')).toBeDefined()
  })

  it('runs editor commands and emits image insertion from toolbar buttons', async () => {
    const editor = createEditorMock()
    const wrapper = mount(DocEditorToolbar, {
      props: { editor },
    })

    await wrapper.get('button[aria-label="加粗"]').trigger('click')
    await wrapper.get('button[aria-label="插入图片"]').trigger('click')

    expect(editor.chain).toHaveBeenCalled()
    expect(wrapper.emitted('insertImage')).toHaveLength(1)
  })

  it('creates code blocks with the default document language from the toolbar', async () => {
    const editor = createEditorMock()
    const chain = editor.chain() as unknown as {
      setCodeBlock: ReturnType<typeof vi.fn>
    }
    const wrapper = mount(DocEditorToolbar, {
      props: { editor },
    })

    await wrapper.get('button[aria-label="代码块"]').trigger('click')

    expect(chain.setCodeBlock).toHaveBeenCalledWith({ language: 'typescript' })
    expect(wrapper.find('[data-testid="doc-code-language-select"]').exists()).toBe(false)
  })
})

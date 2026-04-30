import { EditorContent } from '@tiptap/vue-3'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { useEditor } from '@/features/chat/composables/useEditor'

describe('useEditor', () => {
  it('converts pasted markdown into rich editor content', async () => {
    let editorApi: ReturnType<typeof useEditor>
    const TestEditor = defineComponent({
      setup() {
        const api = useEditor({
          onSubmit: vi.fn(),
        })
        editorApi = api

        return () => api.editor.value
          ? h(EditorContent, { editor: api.editor.value })
          : null
      },
    })

    const wrapper = mount(TestEditor)
    await nextTick()

    const editor = editorApi!.editor.value
    expect(editor).toBeTruthy()

    const event = new Event('paste', { cancelable: true }) as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', {
      value: {
        getData: (type: string) =>
          type === 'text/plain'
            ? '**Bold** and [Muon](https://example.com)'
            : '',
      },
    })

    const handled = editor!.view.someProp('handlePaste', handler =>
      handler(editor!.view, event, null as never))

    expect(handled).toBe(true)
    expect(editor!.getHTML()).toContain('<strong>Bold</strong>')
    expect(editor!.getHTML()).toContain('href="https://example.com"')
    expect(editor!.getText()).toBe('Bold and Muon')

    wrapper.unmount()
  })

  it('allows Enter to create a new line when submitOnEnter is false', async () => {
    const onSubmit = vi.fn()
    let editorApi: ReturnType<typeof useEditor>
    const TestEditor = defineComponent({
      setup() {
        const api = useEditor({
          onSubmit,
          submitOnEnter: false,
        })
        editorApi = api

        return () => api.editor.value
          ? h(EditorContent, { editor: api.editor.value })
          : null
      },
    })

    const wrapper = mount(TestEditor)
    await nextTick()

    const editor = editorApi!.editor.value
    expect(editor).toBeTruthy()
    editor!.commands.setContent('Hello')

    const event = new KeyboardEvent('keydown', { cancelable: true, key: 'Enter' })
    editor!.view.someProp('handleKeyDown', handler =>
      handler(editor!.view, event))

    expect(onSubmit).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('submits an atom-only mention with its rendered text', async () => {
    const onSubmit = vi.fn()
    let editorApi: ReturnType<typeof useEditor>
    const TestEditor = defineComponent({
      setup() {
        const api = useEditor({
          onSubmit,
        })
        editorApi = api

        return () => api.editor.value
          ? h(EditorContent, { editor: api.editor.value })
          : null
      },
    })

    const wrapper = mount(TestEditor)
    await nextTick()

    const editor = editorApi!.editor.value
    expect(editor).toBeTruthy()
    editor!.commands.insertContent({
      type: 'mention',
      attrs: {
        id: '@alice:localhost',
        label: '小红',
      },
    })

    const event = new KeyboardEvent('keydown', { cancelable: true, key: 'Enter' })
    editor!.view.someProp('handleKeyDown', handler =>
      handler(editor!.view, event))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.stringContaining('data-type="mention"'),
      '@小红',
    )

    wrapper.unmount()
  })
})

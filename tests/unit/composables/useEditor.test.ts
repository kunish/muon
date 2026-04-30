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

  it('routes pasted files to the media paste handler before text paste handling', async () => {
    const onPasteFiles = vi.fn()
    let editorApi: ReturnType<typeof useEditor>
    const TestEditor = defineComponent({
      setup() {
        const api = useEditor({
          onSubmit: vi.fn(),
          onPasteFiles,
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
    const imageFile = new File(['image'], 'pasted.png', { type: 'image/png' })
    const event = new Event('paste', { cancelable: true }) as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', {
      value: {
        files: [imageFile],
        getData: (type: string) =>
          type === 'text/plain'
            ? '**Should not become markdown**'
            : '',
      },
    })

    const handled = editor!.view.someProp('handlePaste', handler =>
      handler(editor!.view, event, null as never))

    expect(handled).toBe(true)
    expect(event.defaultPrevented).toBe(true)
    expect(onPasteFiles).toHaveBeenCalledWith([imageFile])
    expect(editor!.getText()).toBe('')

    wrapper.unmount()
  })

  it('reads pasted files from clipboard items when the files list is empty', async () => {
    const onPasteFiles = vi.fn()
    let editorApi: ReturnType<typeof useEditor>
    const TestEditor = defineComponent({
      setup() {
        const api = useEditor({
          onSubmit: vi.fn(),
          onPasteFiles,
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
    const videoFile = new File(['video'], 'pasted.mp4', { type: 'video/mp4' })
    const event = new Event('paste', { cancelable: true }) as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', {
      value: {
        files: [],
        items: [
          {
            kind: 'file',
            getAsFile: () => videoFile,
          },
        ],
        getData: () => '',
      },
    })

    const handled = editor!.view.someProp('handlePaste', handler =>
      handler(editor!.view, event, null as never))

    expect(handled).toBe(true)
    expect(onPasteFiles).toHaveBeenCalledWith([videoFile])

    wrapper.unmount()
  })

  it('inserts pasted media at the current cursor position and opens the local preview', async () => {
    const onPreview = vi.fn()
    const imageFile = new File(['image'], 'cursor.png', { type: 'image/png' })
    const attachment = {
      id: 'attachment-1',
      file: imageFile,
      kind: 'image' as const,
      previewUrl: 'blob:cursor.png',
    }
    let editorApi: ReturnType<typeof useEditor>
    const TestEditor = defineComponent({
      setup() {
        const api = useEditor({
          onSubmit: vi.fn(),
          pendingMedia: {
            getAttachment: id => id === attachment.id ? attachment : undefined,
            onPreview,
          },
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
    editor!.commands.insertContent('before ')
    editorApi!.insertPendingMediaAttachment(attachment.id)
    editor!.commands.insertContent('after')
    await nextTick()

    const html = editor!.getHTML()
    expect(html).toContain('data-pending-media-id="attachment-1"')
    expect(html.indexOf('before')).toBeLessThan(html.indexOf('data-pending-media-id="attachment-1"'))
    expect(html.indexOf('data-pending-media-id="attachment-1"')).toBeLessThan(html.indexOf('after'))
    expect(html).toContain('<p>before </p><div data-pending-media-id="attachment-1"></div><p>after</p>')
    const imagePreview = wrapper.get('[data-testid="pending-paste-image-preview"]')
    expect(imagePreview.attributes('src')).toBe('blob:cursor.png')
    expect(imagePreview.classes()).toContain('object-contain')
    expect(imagePreview.classes()).not.toContain('object-cover')
    expect(imagePreview.element.parentElement?.className).toContain('w-28')

    await imagePreview.trigger('click')

    expect(onPreview).toHaveBeenCalledWith(attachment)

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

  it('submits on Enter with empty text when non-text content is pending', async () => {
    const onSubmit = vi.fn()
    let editorApi: ReturnType<typeof useEditor>
    const TestEditor = defineComponent({
      setup() {
        const api = useEditor({
          onSubmit,
          canSubmit: true,
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

    const event = new KeyboardEvent('keydown', { cancelable: true, key: 'Enter' })
    editor!.view.someProp('handleKeyDown', handler =>
      handler(editor!.view, event))

    expect(onSubmit).toHaveBeenCalledWith('<p></p>', '')

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

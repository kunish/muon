import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('rich text list markers', () => {
  it('keeps list markers visible in the composer and rendered messages', () => {
    const input = readFileSync(resolve(root, 'src/features/chat/components/RichTextInput.vue'), 'utf8')
    const css = readFileSync(resolve(root, 'src/app/main.css'), 'utf8')

    expect(input).toContain('[&_.tiptap_ul]:list-disc')
    expect(input).toContain('[&_.tiptap_ol]:list-decimal')
    expect(css).toContain('@apply my-[0.2em] list-decimal')
    expect(css).toContain('@apply my-[0.2em] list-disc')
  })

  it('keeps compact composer list markers vertically centered with the input line', () => {
    const input = readFileSync(resolve(root, 'src/features/chat/components/RichTextInput.vue'), 'utf8')

    expect(input).toContain('[&_.tiptap_ul]:my-0')
    expect(input).toContain('[&_.tiptap_ol]:my-0')
    expect(input).toContain('[&_.tiptap_li]:leading-6')
    expect(input).not.toContain('[&_.tiptap_ul]:my-1')
    expect(input).not.toContain('[&_.tiptap_ol]:my-1')
  })

  it('keeps the composer caret and placeholder vertically centered', () => {
    const input = readFileSync(resolve(root, 'src/features/chat/components/RichTextInput.vue'), 'utf8')

    expect(input).toContain('leading-6')
    expect(input).toContain('[&_.tiptap]:leading-6')
    expect(input).toContain('[&_.tiptap_p]:m-0')
    expect(input).toContain('[&_.tiptap_p]:leading-6')
  })

  it('keeps compact composer in two-row flex-col layout with action row below the editor', () => {
    const input = readFileSync(resolve(root, 'src/features/chat/components/RichTextInput.vue'), 'utf8')
    const attachment = readFileSync(resolve(root, 'src/features/chat/components/AttachmentMenu.vue'), 'utf8')
    const voiceRecorder = readFileSync(resolve(root, 'src/features/chat/components/VoiceRecorder.vue'), 'utf8')

    expect(input).toContain('flex flex-col rounded-lg bg-input')
    expect(input).toContain('flex h-10 shrink-0 items-center justify-between px-1')
    expect(input).toContain('flex items-center shrink-0 gap-0')
    expect(input).toContain('inline-flex h-8 w-8 items-center justify-center')
    expect(attachment).toContain('inline-flex h-8 w-8 items-center justify-center')
    expect(voiceRecorder).toContain('inline-flex h-8 w-8 items-center justify-center')
    expect(input).not.toContain('flex items-center gap-0 rounded-lg bg-input')
    expect(input).not.toContain('pl-1 pb-1.5')
    expect(input).not.toContain('pr-1 pb-1.5')
  })

  it('keeps a single voice action in the composer toolbar', () => {
    const input = readFileSync(resolve(root, 'src/features/chat/components/RichTextInput.vue'), 'utf8')

    expect(input).toContain('<VoiceRecorder @send="handleVoiceSend" />')
    expect(input).not.toContain('VoiceToTextButton')
  })

  it('keeps document editor lists compact without carrying paragraph spacing into list items', () => {
    const editor = readFileSync(resolve(root, 'src/features/docs/components/editor/DocEditor.vue'), 'utf8')
    const useEditor = readFileSync(resolve(root, 'src/features/docs/composables/useDocEditor.ts'), 'utf8')

    expect(editor).toContain('.doc-editor-body :deep(.ProseMirror li > p)')
    expect(editor).toContain('margin: 0.2em 0 0.45em;')
    expect(editor).toContain('padding-left: 1.2em;')
    expect(editor).toContain('margin: 0.08em 0;')
    expect(editor).toContain('margin-top: 0.35em;')
    expect(useEditor).toContain('isSelectionInEmptyListItem')
    expect(useEditor).toContain('liftListItem(\'listItem\')')
  })

  it('keeps document headings close to adjacent paragraphs and lists', () => {
    const editor = readFileSync(resolve(root, 'src/features/docs/components/editor/DocEditor.vue'), 'utf8')

    expect(editor).toContain('margin: 0.72em 0 0.2em;')
    expect(editor).toContain('margin: 0.64em 0 0.18em;')
    expect(editor).toContain('.doc-editor-body :deep(.ProseMirror h1 + p)')
    expect(editor).toContain('.doc-editor-body :deep(.ProseMirror h1 + ul)')
    expect(editor).toContain('.doc-editor-body :deep(.ProseMirror ul + h2)')
    expect(editor).toContain('margin-top: 0.05em;')
    expect(editor).toContain('margin-top: 0.56em;')
  })

  it('keeps document table headers left aligned', () => {
    const editor = readFileSync(resolve(root, 'src/features/docs/components/editor/DocEditor.vue'), 'utf8')

    expect(editor).toContain('.doc-editor-body :deep(.ProseMirror th)')
    expect(editor).toContain('text-align: left;')
  })

  it('marks document images as previewable', () => {
    const editor = readFileSync(resolve(root, 'src/features/docs/components/editor/DocEditor.vue'), 'utf8')

    expect(editor).toContain('.doc-editor-body :deep(.ProseMirror img)')
    expect(editor).toContain('cursor: zoom-in;')
  })
})

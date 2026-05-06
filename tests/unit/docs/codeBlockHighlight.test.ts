import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DOC_CODE_LANGUAGE,
  DOC_CODE_LANGUAGE_OPTIONS,
  normalizeDocCodeLanguage,
} from '@/features/docs/lib/codeBlockLanguages'

const root = process.cwd()

describe('doc code block highlighting', () => {
  it('offers common languages and normalizes unsupported values', () => {
    expect(DEFAULT_DOC_CODE_LANGUAGE).toBe('typescript')
    expect(DOC_CODE_LANGUAGE_OPTIONS.map(option => option.value)).toEqual([
      'plaintext',
      'typescript',
      'javascript',
      'json',
      'bash',
      'python',
      'java',
      'go',
      'rust',
      'sql',
      'css',
      'xml',
      'markdown',
    ])
    expect(normalizeDocCodeLanguage('python')).toBe('python')
    expect(normalizeDocCodeLanguage('unknown')).toBe('typescript')
  })

  it('uses lowlight for document code blocks and exposes toolbar language switching', () => {
    const editor = readFileSync(resolve(root, 'src/features/docs/composables/useDocEditor.ts'), 'utf8')
    const codeBlockNodeView = readFileSync(resolve(root, 'src/features/docs/lib/codeBlockNodeView.ts'), 'utf8')
    const styles = readFileSync(resolve(root, 'src/features/docs/components/editor/DocEditor.vue'), 'utf8')

    expect(editor).toContain('CodeBlockLowlight.extend')
    expect(editor).toContain('createDocCodeBlockNodeView')
    expect(editor).toContain('DocCodeBlockLowlight.configure')
    expect(editor).toContain('codeBlock: false')
    expect(editor).toContain('createLowlight(common)')
    expect(editor).not.toContain('VueNodeViewRenderer')
    expect(codeBlockNodeView).toContain('data-testid')
    expect(codeBlockNodeView).toContain('doc-code-block-language-select')
    expect(codeBlockNodeView).toContain('focus(pos + 1).updateAttributes(\'codeBlock\', { language }).run()')
    expect(codeBlockNodeView).toContain('stopEvent: isToolbarEvent')
    expect(styles).toContain('--doc-code-bg:')
    expect(styles).toContain(':global(.dark) .doc-editor-body')
    expect(styles).toContain('.doc-editor-body :deep(.doc-code-block-toolbar)')
    expect(styles).toContain('.doc-editor-body :deep(.doc-code-block-view pre)')
    expect(styles).toContain('.doc-editor-body :deep(.doc-code-block-view code)')
    expect(styles).toContain('.doc-editor-body :deep(.ProseMirror > pre)')
    expect(styles).toContain('.doc-editor-body :deep(.hljs-keyword)')
    expect(styles).toContain('.doc-editor-body :deep(.hljs-string)')
  })
})

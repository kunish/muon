import { describe, expect, it } from 'vitest'
import { markdownFromProseMirror } from '@/features/docs/lib/exportDoc'

describe('markdownFromProseMirror', () => {
  it('serializes headings, paragraphs, and inline marks', () => {
    const md = markdownFromProseMirror({
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '章节标题' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'plain ' },
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'code', marks: [{ type: 'code' }] },
          ],
        },
      ],
    })
    expect(md).toContain('## 章节标题')
    expect(md).toContain('plain **bold** and `code`')
  })

  it('serializes bullet and ordered lists', () => {
    const md = markdownFromProseMirror({
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'first' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'second' }] }] },
          ],
        },
        {
          type: 'orderedList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }] }],
        },
      ],
    })
    expect(md).toContain('- first')
    expect(md).toContain('- second')
    expect(md).toContain('1. one')
  })

  it('serializes code blocks with language fences', () => {
    const md = markdownFromProseMirror({
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'ts' },
          content: [{ type: 'text', text: 'const a = 1' }],
        },
      ],
    })
    expect(md).toContain('```ts')
    expect(md).toContain('const a = 1')
  })

  it('returns an empty string for an empty doc', () => {
    expect(markdownFromProseMirror({ content: [] })).toBe('')
    expect(markdownFromProseMirror(null)).toBe('')
  })
})

import type { Editor } from '@tiptap/core'
import { triggerBlobDownload } from '@/shared/lib/download'

interface ProseMirrorMark {
  type: string
  attrs?: Record<string, unknown>
}

interface ProseMirrorNode {
  type: string
  text?: string
  marks?: ProseMirrorMark[]
  attrs?: Record<string, unknown>
  content?: ProseMirrorNode[]
}

function sanitizeFileName(title: string): string {
  return (title.trim() || 'document').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80)
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function attrString(attrs: Record<string, unknown> | undefined, key: string): string {
  const value = attrs?.[key]
  return typeof value === 'string' ? value : ''
}

function serializeInline(nodes: ProseMirrorNode[] | undefined): string {
  if (!nodes) return ''
  return nodes
    .map((node) => {
      if (node.type === 'text') {
        let text = node.text ?? ''
        for (const mark of node.marks ?? []) {
          if (mark.type === 'bold') text = `**${text}**`
          else if (mark.type === 'italic') text = `*${text}*`
          else if (mark.type === 'code') text = `\`${text}\``
          else if (mark.type === 'strike') text = `~~${text}~~`
          else if (mark.type === 'link') text = `[${text}](${attrString(mark.attrs, 'href')})`
        }
        return text
      }
      if (node.type === 'hardBreak') return '  \n'
      if (node.type === 'image') return `![${attrString(node.attrs, 'alt')}](${attrString(node.attrs, 'src')})`
      return serializeInline(node.content)
    })
    .join('')
}

function serializeList(items: ProseMirrorNode[] | undefined, depth: number, ordered: boolean): string {
  if (!items) return ''
  return items
    .map((item, index) => {
      const marker = ordered ? `${index + 1}.` : '-'
      const indent = '  '.repeat(depth)
      const lines = serializeBlocks(item.content, depth + 1).split('\n')
      const first = `${indent}${marker} ${lines[0] ?? ''}`
      const rest = lines.slice(1).map((line) => (line ? `${indent}  ${line}` : line))
      return [first, ...rest].join('\n')
    })
    .join('\n')
}

function serializeBlocks(nodes: ProseMirrorNode[] | undefined, depth = 0): string {
  if (!nodes) return ''
  const out: string[] = []
  for (const node of nodes) {
    switch (node.type) {
      case 'heading': {
        const level = Number(node.attrs?.level ?? 1)
        out.push(`${'#'.repeat(Math.min(Math.max(level, 1), 6))} ${serializeInline(node.content)}`)
        break
      }
      case 'paragraph':
        out.push(serializeInline(node.content))
        break
      case 'bulletList':
        out.push(serializeList(node.content, depth, false))
        break
      case 'orderedList':
        out.push(serializeList(node.content, depth, true))
        break
      case 'blockquote':
        out.push(
          serializeBlocks(node.content, depth)
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n'),
        )
        break
      case 'codeBlock': {
        const language = attrString(node.attrs, 'language')
        const code = node.content?.map((child) => child.text ?? '').join('') ?? ''
        out.push(`\`\`\`${language}\n${code}\n\`\`\``)
        break
      }
      case 'image':
        out.push(`![${attrString(node.attrs, 'alt')}](${attrString(node.attrs, 'src')})`)
        break
      case 'horizontalRule':
        out.push('---')
        break
      default:
        // 表格等未专门处理的节点退化为其文本内容（保留内容、不静默丢弃）
        out.push(serializeInline(node.content))
    }
  }
  return out.filter((segment) => segment.length > 0).join('\n\n')
}

/** 从 ProseMirror JSON 文档序列化为 Markdown（覆盖标题/段落/列表/引用/代码/图片/分隔线） */
export function markdownFromProseMirror(doc: { content?: ProseMirrorNode[] } | null | undefined): string {
  return serializeBlocks(doc?.content)
}

export function exportDocAsHtml(editor: Editor, title: string): void {
  const safeTitle = escapeHtml(title.trim() || 'Untitled')
  const html = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
</head>
<body>
<h1>${safeTitle}</h1>
${editor.getHTML()}
</body>
</html>
`
  triggerBlobDownload(new Blob([html], { type: 'text/html' }), `${sanitizeFileName(title)}.html`)
}

export function exportDocAsMarkdown(editor: Editor, title: string): void {
  const body = markdownFromProseMirror(editor.getJSON() as { content?: ProseMirrorNode[] })
  const markdown = `# ${title.trim() || 'Untitled'}\n\n${body}\n`
  triggerBlobDownload(new Blob([markdown], { type: 'text/markdown' }), `${sanitizeFileName(title)}.md`)
}

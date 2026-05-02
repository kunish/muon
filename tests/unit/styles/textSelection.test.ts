import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('text selection rules', () => {
  it('disables selection by default at the app shell level', () => {
    const css = readSource('packages/ui/src/styles.css')

    expect(css).toContain('-webkit-user-select: none')
    expect(css).toContain('user-select: none')
  })

  it('keeps editable and message payload text selectable', () => {
    const css = `${readSource('packages/ui/src/styles.css')}\n${readSource('src/app/main.css')}`
    const chatMessage = readSource('src/features/chat/components/ChatMessage.vue')
    const richTextInput = readSource('src/features/chat/components/RichTextInput.vue')

    expect(css).toContain('[contenteditable=\'true\']')
    expect(css).toContain('.rich-editor')
    expect(css).toContain('.ProseMirror')
    expect(css).toContain('.rich-message-content')
    expect(css).toContain('.message-selectable-text')
    expect(css).toContain('.msg-bubble')
    expect(css).toContain('user-select: text')
    expect(chatMessage).toContain('message-selectable-text')
    expect(richTextInput).toContain('rich-editor')
  })
})

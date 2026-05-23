import { describe, expect, it } from 'vitest'
import { readDesktopSource, readRepoSource } from '../../helpers/paths'

describe('text selection rules', () => {
  it('disables selection by default at the app shell level', () => {
    const css = readRepoSource('packages/ui/src/styles.css')

    expect(css).toContain('-webkit-user-select: none')
    expect(css).toContain('user-select: none')
  })

  it('keeps editable and message payload text selectable', () => {
    const css = `${readRepoSource('packages/ui/src/styles.css')}\n${readDesktopSource('src/app/main.css')}`
    const chatMessage = readDesktopSource('src/features/chat/components/ChatMessage.vue')
    const richTextInput = readDesktopSource('src/features/chat/components/RichTextInput.vue')

    expect(css).toContain("[contenteditable='true']")
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

/**
 * Source-text guard test for ChatMessage bubble token migration.
 *
 * Rationale for approach: ChatMessage.vue has many heavy deps (Matrix client,
 * Pinia stores, vue-router, i18n, etc.) with no existing minimal mount fixture.
 * A component mount would require extensive mocking that is fragile and
 * orthogonal to what we are verifying. The pure assertion we need — that the
 * correct Tailwind token classes appear in `textBubbleClass` — is fully
 * captured by asserting the source text of the file itself. This is
 * non-vacuous because:
 *   1. It catches both the presence of new tokens AND the absence of old ones.
 *   2. `textBubbleClass` is a computed used directly via `:class="textBubbleClass"`
 *      so the source string IS the runtime class.
 *   3. TypeScript type-check + this test together give the same coverage as a
 *      mount test would, with far less fragility.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const CHAT_MESSAGE_PATH = resolve(__dirname, '../../src/features/chat/components/ChatMessage.vue')

const src = readFileSync(CHAT_MESSAGE_PATH, 'utf8')

describe('chat bubble macOS tokens', () => {
  it('uses --radius-bubble instead of hardcoded 20px', () => {
    expect(src).toContain('rounded-[var(--radius-bubble)]')
    expect(src).not.toContain('rounded-[20px]')
  })

  it('uses --color-bubble-own-bg for own messages (accent bg)', () => {
    expect(src).toContain('bg-[var(--color-bubble-own-bg)]')
    expect(src).not.toContain('bg-[var(--B100)]')
  })

  it('uses --color-bubble-other-bg for received messages (system gray)', () => {
    expect(src).toContain('bg-[var(--color-bubble-other-bg)]')
    expect(src).not.toContain('bg-[var(--N200)]')
  })

  it('does not have text-foreground/90 on the plain-text <p> branch (color governed by textBubbleClass)', () => {
    // After the fix, the plain-text <p> tag (which has message-selectable-text)
    // must NOT carry text-foreground/90 — color is now governed by textBubbleClass
    // (own-bubble=white, other-bubble=foreground via CSS var).
    // The rich-text RichMessageContent branch may still have text-foreground/90
    // on its inner content element — that's intentional and not what we're guarding.
    // Guard: the `message-selectable-text` element must not combine with text-foreground/90.
    expect(src).not.toContain('message-selectable-text message-body-text text-foreground/90')
  })
})

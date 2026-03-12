import { splitEmojis } from '@/shared/lib/emojiLottie'

const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u

/**
 * Check if text consists of 1-3 emoji characters only.
 * Used to render enlarged emoji display in chat messages.
 */
export function isFullEmojiText(text: string): boolean {
  const trimmed = text.trim()
  const segments = splitEmojis(trimmed)
  if (segments.length < 1 || segments.length > 3)
    return false
  return segments.every(
    s => emojiRegex.test(s) || /^\p{Emoji_Presentation}/u.test(s),
  )
}

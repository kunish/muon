import type { DesktopEffect } from '@/shared/lib/effect'
import { fromPromise, runDesktopEffect } from '@/shared/lib/effect'
import { getClient } from './client'

export function sendTypingEffect(roomId: string, isTyping: boolean, timeout = 5000): DesktopEffect<void> {
  return fromPromise(() => getClient().sendTyping(roomId, isTyping, timeout))
}

export function sendTyping(roomId: string, isTyping: boolean, timeout = 5000): Promise<void> {
  return runDesktopEffect(sendTypingEffect(roomId, isTyping, timeout))
}

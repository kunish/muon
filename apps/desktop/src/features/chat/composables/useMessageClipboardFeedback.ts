import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { toast } from 'vue-sonner'
import { fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { copyMessageContentToClipboardEffect } from '../lib/messageClipboard'

export function useMessageClipboardFeedback() {
  const { t } = useI18n()

  function copyMessageContentWithFeedbackEffect(content: unknown): DesktopEffect<void> {
    return copyMessageContentToClipboardEffect(content).pipe(
      Effect.flatMap(() => fromSync(() => toast.success(t('chat.message_text_copied')))),
      Effect.catchAll(() => fromSync(() => toast.error(t('chat.copy_message_text_failed')))),
    )
  }

  function copyMessageContentWithFeedback(content: unknown): Promise<void> {
    return runDesktopEffect(copyMessageContentWithFeedbackEffect(content))
  }

  return {
    copyMessageContentWithFeedbackEffect,
    copyMessageContentWithFeedback,
  }
}

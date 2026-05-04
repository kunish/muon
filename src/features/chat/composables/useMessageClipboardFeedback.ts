import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { copyMessageContentToClipboard } from '../lib/messageClipboard'

export function useMessageClipboardFeedback() {
  const { t } = useI18n()

  async function copyMessageContentWithFeedback(content: unknown): Promise<void> {
    try {
      await copyMessageContentToClipboard(content)
      toast.success(t('chat.message_text_copied'))
    }
    catch {
      toast.error(t('chat.copy_message_text_failed'))
    }
  }

  return {
    copyMessageContentWithFeedback,
  }
}

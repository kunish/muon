import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { getClient } from '@/matrix/client'

export function useMemberActions() {
  const { t } = useI18n()

  async function kickMember(roomId: string, userId: string, reason?: string) {
    try {
      await getClient().kick(roomId, userId, reason)
    }
    catch (err) {
      console.error('Failed to kick member:', err)
      toast.error(t('server.kick_failed'))
      throw err
    }
  }

  async function banMember(roomId: string, userId: string, reason?: string) {
    try {
      await getClient().ban(roomId, userId, reason)
    }
    catch (err) {
      console.error('Failed to ban member:', err)
      toast.error(t('server.ban_failed'))
      throw err
    }
  }

  return { kickMember, banMember }
}

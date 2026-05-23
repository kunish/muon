import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { getClient } from '@/matrix/client'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'

export function useMemberActions() {
  const { t } = useI18n()

  function kickMemberEffect(roomId: string, userId: string, reason?: string): DesktopEffect<void> {
    return fromPromise(() => getClient().kick(roomId, userId, reason)).pipe(
      Effect.catchAll((err) =>
        Effect.gen(function* () {
          yield* fromSync(() => {
            console.error('Failed to kick member:', err)
            toast.error(t('server.kick_failed'))
          })
          return yield* Effect.fail(err)
        }),
      ),
    )
  }

  function kickMember(roomId: string, userId: string, reason?: string) {
    return runDesktopEffect(kickMemberEffect(roomId, userId, reason))
  }

  function banMemberEffect(roomId: string, userId: string, reason?: string): DesktopEffect<void> {
    return fromPromise(() => getClient().ban(roomId, userId, reason)).pipe(
      Effect.catchAll((err) =>
        Effect.gen(function* () {
          yield* fromSync(() => {
            console.error('Failed to ban member:', err)
            toast.error(t('server.ban_failed'))
          })
          return yield* Effect.fail(err)
        }),
      ),
    )
  }

  function banMember(roomId: string, userId: string, reason?: string) {
    return runDesktopEffect(banMemberEffect(roomId, userId, reason))
  }

  return { kickMemberEffect, banMemberEffect, kickMember, banMember }
}

import type { MatrixClient } from 'matrix-js-sdk'
import type { DesktopEffect } from '@/shared/lib/effect'
import { getClient } from '@matrix/client'
import { Effect } from 'effect'
import { fromSync, runDesktopSync } from '@/shared/lib/effect'
import { userColor } from '../types/doc'

type DocUserClient = Pick<MatrixClient, 'getUser' | 'getUserId'>

export interface CurrentDocUser {
  id: string
  name: string
  color: string
}

export function resolveCurrentDocUser(userName?: string, client?: DocUserClient): CurrentDocUser {
  return runDesktopSync(resolveCurrentDocUserEffect(userName, client))
}

export function resolveCurrentDocUserEffect(userName?: string, client?: DocUserClient): DesktopEffect<CurrentDocUser> {
  return fromSync(() => {
    const matrixClient = client ?? getClient()
    const id = matrixClient.getUserId() ?? 'current-user'
    const profileName = matrixClient.getUser(id)?.displayName
    const name = userName?.trim() || profileName || id

    return {
      id,
      name,
      color: userColor(id),
    }
  }).pipe(
    Effect.catchAll(() =>
      fromSync(() => {
        const id = 'current-user'
        return {
          id,
          name: userName?.trim() || '我',
          color: userColor(id),
        }
      }),
    ),
  )
}

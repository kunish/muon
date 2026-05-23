import type { MatrixClient } from 'matrix-js-sdk'
import { getClient } from '@matrix/client'
import { userColor } from '../types/doc'

type DocUserClient = Pick<MatrixClient, 'getUser' | 'getUserId'>

export interface CurrentDocUser {
  id: string
  name: string
  color: string
}

export function resolveCurrentDocUser(userName?: string, client?: DocUserClient): CurrentDocUser {
  try {
    const matrixClient = client ?? getClient()
    const id = matrixClient.getUserId() ?? 'current-user'
    const profileName = matrixClient.getUser(id)?.displayName
    const name = userName?.trim() || profileName || id

    return {
      id,
      name,
      color: userColor(id),
    }
  } catch {
    const id = 'current-user'
    return {
      id,
      name: userName?.trim() || '我',
      color: userColor(id),
    }
  }
}

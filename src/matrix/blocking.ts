import type { EmptyObject } from 'matrix-js-sdk/lib/@types/common'
import { EventType } from 'matrix-js-sdk'
import { getClient } from './client'

type IgnoredUsers = Record<string, EmptyObject>

/** 获取已屏蔽用户列表 */
export function getBlockedUsers(): string[] {
  const client = getClient()
  const event = client.getAccountData(EventType.IgnoredUserList)
  const content = event?.getContent() as { ignored_users?: IgnoredUsers } | undefined
  return Object.keys(content?.ignored_users ?? {})
}

/** 检查用户是否被屏蔽 */
export function isUserBlocked(userId: string): boolean {
  return getBlockedUsers().includes(userId)
}

/** 屏蔽用户 */
export async function blockUser(userId: string): Promise<void> {
  const client = getClient()
  const current = getBlockedUsers()
  if (current.includes(userId))
    return
  const ignored_users: IgnoredUsers = {}
  for (const uid of [...current, userId]) {
    ignored_users[uid] = {} as EmptyObject
  }
  await client.setAccountData(EventType.IgnoredUserList, { ignored_users })
}

/** 解除屏蔽 */
export async function unblockUser(userId: string): Promise<void> {
  const client = getClient()
  const current = getBlockedUsers()
  const ignored_users: IgnoredUsers = {}
  for (const uid of current) {
    if (uid !== userId)
      ignored_users[uid] = {} as EmptyObject
  }
  await client.setAccountData(EventType.IgnoredUserList, { ignored_users })
}

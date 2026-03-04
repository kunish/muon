import { getClient } from './client'

/** 获取已屏蔽用户列表 */
export function getBlockedUsers(): string[] {
  const client = getClient()
  const event = client.getAccountData('m.ignored_user_list' as any)
  const content = event?.getContent() as { ignored_users?: Record<string, object> } | undefined
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
  const ignored_users: Record<string, object> = {}
  for (const uid of [...current, userId]) {
    ignored_users[uid] = {}
  }
  await client.setAccountData('m.ignored_user_list' as any, { ignored_users } as any)
}

/** 解除屏蔽 */
export async function unblockUser(userId: string): Promise<void> {
  const client = getClient()
  const current = getBlockedUsers()
  const ignored_users: Record<string, object> = {}
  for (const uid of current) {
    if (uid !== userId)
      ignored_users[uid] = {}
  }
  await client.setAccountData('m.ignored_user_list' as any, { ignored_users } as any)
}

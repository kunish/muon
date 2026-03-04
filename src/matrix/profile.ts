import { getClient } from './client'

/** 获取当前用户的 displayName */
export function getMyDisplayName(): string {
  const client = getClient()
  const userId = client.getUserId()
  if (!userId)
    return ''
  const user = client.getUser(userId)
  return user?.displayName || userId
}

/** 获取当前用户的头像 mxc URL */
export function getMyAvatarUrl(): string | undefined {
  const client = getClient()
  const userId = client.getUserId()
  if (!userId)
    return undefined
  const user = client.getUser(userId)
  return user?.avatarUrl || undefined
}

/** 修改 displayName */
export async function setMyDisplayName(name: string): Promise<void> {
  const client = getClient()
  await client.setDisplayName(name)
}

/** 上传并设置头像 */
export async function setMyAvatar(file: File): Promise<void> {
  const client = getClient()
  const { content_uri } = await client.uploadContent(file)
  await client.setAvatarUrl(content_uri)
}

/** 设置当前用户的自定义状态（emoji + 文本） */
export async function setMyStatus(statusMsg: string): Promise<void> {
  const client = getClient()
  await client.setPresence({ presence: 'online', status_msg: statusMsg })
}

/** 获取当前用户的自定义状态 */
export function getMyStatus(): string {
  const client = getClient()
  const userId = client.getUserId()
  if (!userId)
    return ''
  const user = client.getUser(userId)
  return user?.presenceStatusMsg || ''
}

/** 清除自定义状态 */
export async function clearMyStatus(): Promise<void> {
  const client = getClient()
  await client.setPresence({ presence: 'online', status_msg: '' })
}

/** 获取用户的 Last Seen 信息 */
export function getUserPresenceInfo(userId: string): {
  presence: string
  lastActiveAgo?: number
  statusMsg?: string
} {
  try {
    const client = getClient()
    const user = client.getUser(userId)
    if (!user)
      return { presence: 'offline' }
    return {
      presence: (user.presence as string) || 'offline',
      lastActiveAgo: user.lastActiveAgo,
      statusMsg: user.presenceStatusMsg,
    }
  }
  catch {
    return { presence: 'offline' }
  }
}

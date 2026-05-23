import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'
import { getClient } from './client'

/** 获取当前用户的 displayName */
export function getMyDisplayNameEffect(): DesktopEffect<string> {
  return fromSync(() => {
    const client = getClient()
    const userId = client.getUserId()
    if (!userId) return ''
    const user = client.getUser(userId)
    return user?.displayName || userId
  })
}

export function getMyDisplayName(): string {
  return runDesktopSync(getMyDisplayNameEffect())
}

/** 获取当前用户的头像 mxc URL */
export function getMyAvatarUrlEffect(): DesktopEffect<string | undefined> {
  return fromSync(() => {
    const client = getClient()
    const userId = client.getUserId()
    if (!userId) return undefined
    const user = client.getUser(userId)
    return user?.avatarUrl || undefined
  })
}

export function getMyAvatarUrl(): string | undefined {
  return runDesktopSync(getMyAvatarUrlEffect())
}

/** 修改 displayName */
export function setMyDisplayNameEffect(name: string): DesktopEffect<void> {
  return fromPromise(() => getClient().setDisplayName(name))
}

export function setMyDisplayName(name: string): Promise<void> {
  return runDesktopEffect(setMyDisplayNameEffect(name))
}

/** 上传并设置头像 */
export function setMyAvatarEffect(file: File): DesktopEffect<void> {
  return Effect.gen(function* () {
    const client = getClient()
    const { content_uri } = yield* fromPromise(() => client.uploadContent(file))
    yield* fromPromise(() => client.setAvatarUrl(content_uri))
  })
}

export function setMyAvatar(file: File): Promise<void> {
  return runDesktopEffect(setMyAvatarEffect(file))
}

/** 设置当前用户的自定义状态（emoji + 文本） */
export function setMyStatusEffect(statusMsg: string): DesktopEffect<void> {
  return fromPromise(() => getClient().setPresence({ presence: 'online', status_msg: statusMsg }))
}

export function setMyStatus(statusMsg: string): Promise<void> {
  return runDesktopEffect(setMyStatusEffect(statusMsg))
}

/** 获取当前用户的自定义状态 */
export function getMyStatusEffect(): DesktopEffect<string> {
  return fromSync(() => {
    const client = getClient()
    const userId = client.getUserId()
    if (!userId) return ''
    const user = client.getUser(userId)
    return user?.presenceStatusMsg || ''
  })
}

export function getMyStatus(): string {
  return runDesktopSync(getMyStatusEffect())
}

/** 清除自定义状态 */
export function clearMyStatusEffect(): DesktopEffect<void> {
  return fromPromise(() => getClient().setPresence({ presence: 'online', status_msg: '' }))
}

export function clearMyStatus(): Promise<void> {
  return runDesktopEffect(clearMyStatusEffect())
}

/** 获取用户的 Last Seen 信息 */
export interface UserPresenceInfo {
  presence: string
  lastActiveAgo?: number
  statusMsg?: string
}

export function getUserPresenceInfoEffect(userId: string): DesktopEffect<UserPresenceInfo> {
  return fromSync(() => {
    const client = getClient()
    const user = client.getUser(userId)
    if (!user) return { presence: 'offline' }
    return {
      presence: (user.presence as string) || 'offline',
      lastActiveAgo: user.lastActiveAgo,
      statusMsg: user.presenceStatusMsg,
    }
  }).pipe(Effect.catchAll(() => Effect.succeed({ presence: 'offline' })))
}

export function getUserPresenceInfo(userId: string): UserPresenceInfo {
  return runDesktopSync(getUserPresenceInfoEffect(userId))
}

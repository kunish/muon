import type { EmptyObject } from 'matrix-js-sdk/lib/@types/common'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { EventType } from 'matrix-js-sdk'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'
import { getClient } from './client'

type IgnoredUsers = Record<string, EmptyObject>

/** 获取已屏蔽用户列表 */
export function getBlockedUsersEffect(): DesktopEffect<string[]> {
  return fromSync(() => {
    const client = getClient()
    const event = client.getAccountData(EventType.IgnoredUserList)
    const content = event?.getContent() as { ignored_users?: IgnoredUsers } | undefined
    return Object.keys(content?.ignored_users ?? {})
  })
}

export function getBlockedUsers(): string[] {
  return runDesktopSync(getBlockedUsersEffect())
}

/** 检查用户是否被屏蔽 */
export function isUserBlockedEffect(userId: string): DesktopEffect<boolean> {
  return Effect.map(getBlockedUsersEffect(), (users) => users.includes(userId))
}

export function isUserBlocked(userId: string): boolean {
  return runDesktopSync(isUserBlockedEffect(userId))
}

/** 屏蔽用户 */
export function blockUserEffect(userId: string): DesktopEffect<void> {
  return Effect.gen(function* () {
    const client = getClient()
    const current = yield* getBlockedUsersEffect()
    if (current.includes(userId)) return
    const ignored_users: IgnoredUsers = {}
    for (const uid of [...current, userId]) {
      ignored_users[uid] = {} as EmptyObject
    }
    yield* fromPromise(() => client.setAccountData(EventType.IgnoredUserList, { ignored_users }))
  })
}

export function blockUser(userId: string): Promise<void> {
  return runDesktopEffect(blockUserEffect(userId))
}

/** 解除屏蔽 */
export function unblockUserEffect(userId: string): DesktopEffect<void> {
  return Effect.gen(function* () {
    const client = getClient()
    const current = yield* getBlockedUsersEffect()
    const ignored_users: IgnoredUsers = {}
    for (const uid of current) {
      if (uid !== userId) ignored_users[uid] = {} as EmptyObject
    }
    yield* fromPromise(() => client.setAccountData(EventType.IgnoredUserList, { ignored_users }))
  })
}

export function unblockUser(userId: string): Promise<void> {
  return runDesktopEffect(unblockUserEffect(userId))
}

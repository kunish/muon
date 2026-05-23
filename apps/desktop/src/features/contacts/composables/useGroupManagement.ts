import type { DesktopEffect } from '@/shared/lib/effect'
import { getClient } from '@matrix/client'
import { Effect } from 'effect'
import { Preset } from 'matrix-js-sdk'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'

export function useGroupManagement() {
  function createGroupEffect(opts: {
    name: string
    topic?: string
    userIds: string[]
    isEncrypted?: boolean
  }): DesktopEffect<string> {
    const client = getClient()
    const initialState = opts.isEncrypted
      ? [{ type: 'm.room.encryption', content: { algorithm: 'm.megolm.v1.aes-sha2' }, state_key: '' }]
      : []
    return Effect.gen(function* () {
      const { room_id } = yield* fromPromise(() =>
        client.createRoom({
          name: opts.name,
          topic: opts.topic,
          invite: opts.userIds,
          initial_state: initialState,
          preset: Preset.PrivateChat,
        }),
      )
      return room_id
    })
  }

  function createGroup(opts: {
    name: string
    topic?: string
    userIds: string[]
    isEncrypted?: boolean
  }): Promise<string> {
    return runDesktopEffect(createGroupEffect(opts))
  }

  function inviteUserEffect(roomId: string, userId: string): DesktopEffect<void> {
    return fromPromise(() => getClient().invite(roomId, userId))
  }

  function inviteUser(roomId: string, userId: string) {
    return runDesktopEffect(inviteUserEffect(roomId, userId))
  }

  function kickUserEffect(roomId: string, userId: string, reason?: string): DesktopEffect<void> {
    return fromPromise(() => getClient().kick(roomId, userId, reason))
  }

  function kickUser(roomId: string, userId: string, reason?: string) {
    return runDesktopEffect(kickUserEffect(roomId, userId, reason))
  }

  function setUserPowerLevelEffect(roomId: string, userId: string, level: number): DesktopEffect<void> {
    return Effect.gen(function* () {
      const update = yield* fromSync(() => {
        const client = getClient()
        const room = client.getRoom(roomId)
        if (!room) return null
        const plEvent = room.currentState.getStateEvents('m.room.power_levels', '')
        const content = plEvent?.getContent() || {}
        const users = { ...content.users, [userId]: level }
        return { client, content, users }
      })
      if (!update) return
      yield* fromPromise(() =>
        update.client.sendStateEvent(roomId, 'm.room.power_levels', { ...update.content, users: update.users }),
      )
    })
  }

  function setUserPowerLevel(roomId: string, userId: string, level: number) {
    return runDesktopEffect(setUserPowerLevelEffect(roomId, userId, level))
  }

  return {
    createGroupEffect,
    inviteUserEffect,
    kickUserEffect,
    setUserPowerLevelEffect,
    createGroup,
    inviteUser,
    kickUser,
    setUserPowerLevel,
  }
}

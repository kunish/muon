import type { IMyDevice } from 'matrix-js-sdk'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'
import { getClient } from './client'

export function getDevicesEffect(): DesktopEffect<IMyDevice[]> {
  return Effect.gen(function* () {
    const res = yield* fromPromise(() => getClient().getDevices())
    return res.devices ?? []
  })
}

export function getDevices(): Promise<IMyDevice[]> {
  return runDesktopEffect(getDevicesEffect())
}

export function getCurrentDeviceIdEffect(): DesktopEffect<string | null> {
  return fromSync(() => getClient().getDeviceId())
}

export function getCurrentDeviceId(): string | null {
  return runDesktopSync(getCurrentDeviceIdEffect())
}

interface PasswordAuthDict {
  type: 'm.login.password'
  identifier: { type: 'm.id.user'; user: string }
  password: string
}

interface DeleteDeviceOutcome {
  /** 服务器要求密码二次认证（UIA）；UI 应提示输入密码后重试 */
  needsPassword: boolean
}

/**
 * 注销（删除）一个设备会话。部分 homeserver 要求 User-Interactive Auth，
 * 首次无密码调用若返回 401+flows 则回报 needsPassword，由 UI 提供密码后重试。
 */
export function deleteDeviceEffect(deviceId: string, password?: string): DesktopEffect<DeleteDeviceOutcome> {
  return Effect.gen(function* () {
    const client = getClient()
    const userId = client.getUserId()
    const auth: PasswordAuthDict | undefined =
      password && userId
        ? { type: 'm.login.password', identifier: { type: 'm.id.user', user: userId }, password }
        : undefined

    return yield* fromPromise(() => client.deleteDevice(deviceId, auth)).pipe(
      Effect.as<DeleteDeviceOutcome>({ needsPassword: false }),
      Effect.catchAll((error) => {
        const matrixError = error as { httpStatus?: number; data?: { flows?: unknown } }
        if (matrixError.httpStatus === 401 && matrixError.data?.flows) {
          return Effect.succeed<DeleteDeviceOutcome>({ needsPassword: true })
        }
        return Effect.fail(error)
      }),
    )
  })
}

export function deleteDevice(deviceId: string, password?: string): Promise<DeleteDeviceOutcome> {
  return runDesktopEffect(deleteDeviceEffect(deviceId, password))
}

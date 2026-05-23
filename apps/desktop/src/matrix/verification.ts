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

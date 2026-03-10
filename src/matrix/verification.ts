import type { IMyDevice } from 'matrix-js-sdk'
import { getClient } from './client'

export async function getDevices(): Promise<IMyDevice[]> {
  const res = await getClient().getDevices()
  return res.devices ?? []
}

export function getCurrentDeviceId(): string | null {
  return getClient().getDeviceId()
}

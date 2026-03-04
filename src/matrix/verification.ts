import { getClient } from './client'

export async function getDevices(): Promise<any[]> {
  const res = await getClient().getDevices()
  return res.devices ?? []
}

export function getCurrentDeviceId(): string | null {
  return getClient().getDeviceId()
}

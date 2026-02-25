import { getClient } from './client'

export async function startVerification(userId: string, deviceId: string) {
  const client = getClient() as any
  const device = client.getStoredDevice(userId, deviceId)
  if (!device)
    throw new Error(`Device ${deviceId} not found`)
  return client.beginKeyVerification('m.sas.v1', userId, deviceId)
}

export async function confirmVerification(verifier: any): Promise<void> {
  await verifier.verify()
}

export function cancelVerification(verifier: any): void {
  verifier.cancel('User cancelled')
}

export function getDevices(userId: string) {
  return (getClient() as any).getStoredDevicesForUser(userId) || []
}

export function isDeviceVerified(userId: string, deviceId: string): boolean {
  const client = getClient() as any
  const device = client.getStoredDevice(userId, deviceId)
  return device?.isVerified() ?? false
}

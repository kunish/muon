import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'

let permissionGranted = false

export async function initNotifications(): Promise<void> {
  permissionGranted = await isPermissionGranted()
  if (!permissionGranted) {
    const permission = await requestPermission()
    permissionGranted = permission === 'granted'
  }
}

export async function showMessageNotification(opts: {
  title: string
  body: string
  roomId: string
}): Promise<void> {
  if (!permissionGranted)
    return
  sendNotification({
    title: opts.title,
    body: opts.body,
  })
}

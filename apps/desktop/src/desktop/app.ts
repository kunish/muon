import { getDesktopBridge } from './bridge'

export async function setAutoLaunchEnabled(enabled: boolean): Promise<void> {
  await getDesktopBridge()?.app.setAutoLaunch(enabled)
}

export async function setCloseToTrayEnabled(enabled: boolean): Promise<void> {
  await getDesktopBridge()?.app.setCloseToTray(enabled)
}

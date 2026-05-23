import type { DesktopEffect } from '@/shared/lib/effect'
import { fromPromise, runDesktopEffect } from '@/shared/lib/effect'
import { getDesktopBridge } from './bridge'

export function setAutoLaunchEnabledEffect(enabled: boolean): DesktopEffect<void> {
  return fromPromise(() => getDesktopBridge()?.app.setAutoLaunch(enabled))
}

export function setAutoLaunchEnabled(enabled: boolean): Promise<void> {
  return runDesktopEffect(setAutoLaunchEnabledEffect(enabled))
}

export function setCloseToTrayEnabledEffect(enabled: boolean): DesktopEffect<void> {
  return fromPromise(() => getDesktopBridge()?.app.setCloseToTray(enabled))
}

export function setCloseToTrayEnabled(enabled: boolean): Promise<void> {
  return runDesktopEffect(setCloseToTrayEnabledEffect(enabled))
}

import type { DesktopEffect } from '@/shared/lib/effect'
import { fromSync, runDesktopSync } from '@/shared/lib/effect'
import { getDesktopBridge } from './bridge'

export interface DesktopWindow {
  hide: () => Promise<void>
  setFocus: () => Promise<void>
  show: () => Promise<void>
}

function bridgeWindow() {
  return getDesktopBridge()?.window
}

export function getCurrentWindowEffect(): DesktopEffect<DesktopWindow> {
  return fromSync(() => {
    const desktopWindow = bridgeWindow()
    if (!desktopWindow) throw new Error('Desktop window APIs are only available in Electron')

    return {
      hide: desktopWindow.hide,
      setFocus: desktopWindow.setFocus,
      show: desktopWindow.show,
    }
  })
}

export function getCurrentWindow(): DesktopWindow {
  return runDesktopSync(getCurrentWindowEffect())
}

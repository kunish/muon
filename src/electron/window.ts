import { getDesktopBridge } from './bridge'

export interface DesktopWindow {
  hide: () => Promise<void>
  setFocus: () => Promise<void>
  show: () => Promise<void>
}

function bridgeWindow() {
  return getDesktopBridge()?.window
}

export function getCurrentWindow(): DesktopWindow {
  const desktopWindow = bridgeWindow()
  if (!desktopWindow)
    throw new Error('Desktop window APIs are only available in Electron')

  return {
    hide: desktopWindow.hide,
    setFocus: desktopWindow.setFocus,
    show: desktopWindow.show,
  }
}

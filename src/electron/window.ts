import type { DesktopMonitor, DesktopPosition, DesktopSize, UnlistenFn } from './bridge'
import { getDesktopBridge } from './bridge'

export class PhysicalPosition implements DesktopPosition {
  readonly type = 'Physical'

  constructor(
    public x: number,
    public y: number,
  ) {}
}

export class PhysicalSize implements DesktopSize {
  readonly type = 'Physical'

  constructor(
    public width: number,
    public height: number,
  ) {}
}

export type { UnlistenFn }

export interface DesktopWindow {
  close: () => Promise<void>
  hide: () => Promise<void>
  isFocused: () => Promise<boolean>
  isMaximized: () => Promise<boolean>
  maximize: () => Promise<void>
  minimize: () => Promise<void>
  onBlurred: (callback: () => void) => Promise<UnlistenFn>
  onFocused: (callback: () => void) => Promise<UnlistenFn>
  onMoved: (callback: () => void) => Promise<UnlistenFn>
  onResized: (callback: () => void) => Promise<UnlistenFn>
  outerPosition: () => Promise<DesktopPosition>
  outerSize: () => Promise<DesktopSize>
  setFocus: () => Promise<void>
  setPosition: (position: DesktopPosition) => Promise<void>
  setSize: (size: DesktopSize) => Promise<void>
  show: () => Promise<void>
  unmaximize: () => Promise<void>
}

function bridgeWindow() {
  return getDesktopBridge()?.window
}

export function getCurrentWindow(): DesktopWindow {
  const desktopWindow = bridgeWindow()
  if (!desktopWindow)
    throw new Error('Desktop window controls are only available in Electron')

  return {
    close: desktopWindow.close,
    hide: desktopWindow.hide,
    isFocused: desktopWindow.isFocused,
    isMaximized: desktopWindow.isMaximized,
    maximize: desktopWindow.maximize,
    minimize: desktopWindow.minimize,
    onBlurred: async callback => desktopWindow.onBlurred(callback),
    onFocused: async callback => desktopWindow.onFocused(callback),
    onMoved: async callback => desktopWindow.onMoved(callback),
    onResized: async callback => desktopWindow.onResized(callback),
    outerPosition: desktopWindow.outerPosition,
    outerSize: desktopWindow.outerSize,
    setFocus: desktopWindow.setFocus,
    setPosition: desktopWindow.setPosition,
    setSize: desktopWindow.setSize,
    show: desktopWindow.show,
    unmaximize: desktopWindow.unmaximize,
  }
}

export async function currentMonitor(): Promise<DesktopMonitor | null> {
  const desktopWindow = bridgeWindow()
  if (!desktopWindow)
    return null

  return desktopWindow.currentMonitor()
}

export function getDesktopPlatform(): string | undefined {
  return getDesktopBridge()?.platform
}

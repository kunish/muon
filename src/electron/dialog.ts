import type { DesktopDialogAskOptions, DesktopDialogOpenOptions, DesktopDialogSaveOptions } from './bridge'
import { getDesktopBridge } from './bridge'

export async function open(options: DesktopDialogOpenOptions & { multiple: true }): Promise<string[] | null>
export async function open(options?: DesktopDialogOpenOptions & { multiple?: false }): Promise<string | null>
export async function open(options?: DesktopDialogOpenOptions): Promise<string | string[] | null> {
  const bridge = getDesktopBridge()
  if (!bridge)
    return null

  return bridge.dialog.open(options)
}

export async function save(options?: DesktopDialogSaveOptions): Promise<string | null> {
  const bridge = getDesktopBridge()
  if (!bridge)
    return null

  return bridge.dialog.save(options)
}

export async function ask(message: string, options?: DesktopDialogAskOptions): Promise<boolean> {
  const bridge = getDesktopBridge()
  if (!bridge) {
    // eslint-disable-next-line no-alert -- Browser-only fallback for renderer-only development.
    return window.confirm(message)
  }

  return bridge.dialog.ask(message, options)
}

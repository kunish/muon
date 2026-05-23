import type { DesktopDialogAskOptions, DesktopDialogOpenOptions, DesktopDialogSaveOptions } from './bridge'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { fromPromise, runDesktopEffect } from '@/shared/lib/effect'
import { requestConfirmDialog } from '@/shared/services/confirmDialog'
import { getDesktopBridge } from './bridge'

export function open(options: DesktopDialogOpenOptions & { multiple: true }): Promise<string[] | null>
export function open(options?: DesktopDialogOpenOptions & { multiple?: false }): Promise<string | null>
export function open(options?: DesktopDialogOpenOptions): Promise<string | string[] | null> {
  return runDesktopEffect(openEffect(options))
}

export function openEffect(options?: DesktopDialogOpenOptions): DesktopEffect<string | string[] | null> {
  const bridge = getDesktopBridge()
  if (!bridge) return Effect.succeed(null)

  return fromPromise(() => bridge.dialog.open(options))
}

export function saveEffect(options?: DesktopDialogSaveOptions): DesktopEffect<string | null> {
  const bridge = getDesktopBridge()
  if (!bridge) return Effect.succeed(null)

  return fromPromise(() => bridge.dialog.save(options))
}

export function save(options?: DesktopDialogSaveOptions): Promise<string | null> {
  return runDesktopEffect(saveEffect(options))
}

export function askEffect(message: string, options?: DesktopDialogAskOptions): DesktopEffect<boolean> {
  return fromPromise(() => requestConfirmDialog(message, options))
}

export function ask(message: string, options?: DesktopDialogAskOptions): Promise<boolean> {
  return runDesktopEffect(askEffect(message, options))
}

import type { DesktopDialogAskOptions } from '@/desktop/bridge'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'

export type ConfirmDialogHandler = (message: string, options?: DesktopDialogAskOptions) => Promise<boolean>

let activeHandler: ConfirmDialogHandler | null = null

export function registerConfirmDialogHandlerEffect(handler: ConfirmDialogHandler): DesktopEffect<() => void> {
  return fromSync(() => {
    activeHandler = handler

    return () => {
      if (activeHandler === handler) activeHandler = null
    }
  })
}

export function registerConfirmDialogHandler(handler: ConfirmDialogHandler): () => void {
  return runDesktopSync(registerConfirmDialogHandlerEffect(handler))
}

export function hasConfirmDialogHandlerEffect(): DesktopEffect<boolean> {
  return fromSync(() => activeHandler !== null)
}

export function hasConfirmDialogHandler(): boolean {
  return runDesktopSync(hasConfirmDialogHandlerEffect())
}

export function requestConfirmDialogEffect(message: string, options?: DesktopDialogAskOptions): DesktopEffect<boolean> {
  if (!activeHandler) return Effect.succeed(false)

  return fromPromise(() => activeHandler!(message, options))
}

export function requestConfirmDialog(message: string, options?: DesktopDialogAskOptions): Promise<boolean> {
  return runDesktopEffect(requestConfirmDialogEffect(message, options))
}

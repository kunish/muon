import type { DesktopDialogAskOptions } from '@/desktop/bridge'

export type ConfirmDialogHandler = (message: string, options?: DesktopDialogAskOptions) => Promise<boolean>

let activeHandler: ConfirmDialogHandler | null = null

export function registerConfirmDialogHandler(handler: ConfirmDialogHandler): () => void {
  activeHandler = handler

  return () => {
    if (activeHandler === handler) activeHandler = null
  }
}

export function hasConfirmDialogHandler(): boolean {
  return activeHandler !== null
}

export function requestConfirmDialog(message: string, options?: DesktopDialogAskOptions): Promise<boolean> {
  if (!activeHandler) return Promise.resolve(false)

  return activeHandler(message, options)
}

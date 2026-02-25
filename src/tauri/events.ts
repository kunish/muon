import { listen } from '@tauri-apps/api/event'

export type UnlistenFn = () => void

export async function onWindowClose(callback: () => void): Promise<UnlistenFn> {
  return listen('tauri://close-requested', callback)
}

export async function onWindowFocus(callback: () => void): Promise<UnlistenFn> {
  return listen('tauri://focus', callback)
}

export async function onWindowBlur(callback: () => void): Promise<UnlistenFn> {
  return listen('tauri://blur', callback)
}

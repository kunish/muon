import { getDesktopBridge } from './bridge'

export async function openPath(path: string): Promise<string> {
  const bridge = getDesktopBridge()
  if (!bridge) return ''

  return bridge.shell.openPath(path)
}

export async function revealItemInDir(path: string): Promise<void> {
  const bridge = getDesktopBridge()
  if (!bridge) return

  await bridge.shell.revealItemInDir(path)
}

export async function openUrl(url: string): Promise<void> {
  const bridge = getDesktopBridge()
  if (!bridge) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }

  await bridge.shell.openUrl(url)
}

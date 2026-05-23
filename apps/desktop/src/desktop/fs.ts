import { getDesktopBridge } from './bridge'

export async function readFile(path: string): Promise<Uint8Array<ArrayBuffer>> {
  const bridge = getDesktopBridge()
  if (!bridge) throw new Error('Desktop file access is only available in Electron')

  return new Uint8Array(await bridge.fs.readFile(path))
}

export async function writeFile(path: string, bytes: Uint8Array): Promise<void> {
  const bridge = getDesktopBridge()
  if (!bridge) throw new Error('Desktop file access is only available in Electron')

  await bridge.fs.writeFile(path, bytes)
}

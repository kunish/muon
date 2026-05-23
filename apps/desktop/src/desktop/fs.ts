import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { getDesktopBridge } from './bridge'

function requireDesktopBridgeEffect(): DesktopEffect<NonNullable<ReturnType<typeof getDesktopBridge>>> {
  return fromSync(() => {
    const bridge = getDesktopBridge()
    if (!bridge) throw new Error('Desktop file access is only available in Electron')
    return bridge
  })
}

export function readFileEffect(path: string): DesktopEffect<Uint8Array<ArrayBuffer>> {
  return Effect.gen(function* () {
    const bridge = yield* requireDesktopBridgeEffect()
    return new Uint8Array(yield* fromPromise(() => bridge.fs.readFile(path)))
  })
}

export function readFile(path: string): Promise<Uint8Array<ArrayBuffer>> {
  return runDesktopEffect(readFileEffect(path))
}

export function writeFileEffect(path: string, bytes: Uint8Array): DesktopEffect<void> {
  return Effect.gen(function* () {
    const bridge = yield* requireDesktopBridgeEffect()
    yield* fromPromise(() => bridge.fs.writeFile(path, bytes))
  })
}

export function writeFile(path: string, bytes: Uint8Array): Promise<void> {
  return runDesktopEffect(writeFileEffect(path, bytes))
}

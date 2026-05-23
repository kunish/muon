import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { getDesktopBridge } from './bridge'

export function openPathEffect(path: string): DesktopEffect<string> {
  const bridge = getDesktopBridge()
  if (!bridge) return Effect.succeed('')

  return fromPromise(() => bridge.shell.openPath(path))
}

export function openPath(path: string): Promise<string> {
  return runDesktopEffect(openPathEffect(path))
}

export function revealItemInDirEffect(path: string): DesktopEffect<void> {
  const bridge = getDesktopBridge()
  if (!bridge) return Effect.void

  return fromPromise(() => bridge.shell.revealItemInDir(path))
}

export function revealItemInDir(path: string): Promise<void> {
  return runDesktopEffect(revealItemInDirEffect(path))
}

export function openUrlEffect(url: string): DesktopEffect<void> {
  const bridge = getDesktopBridge()
  if (!bridge) {
    return fromSync(() => window.open(url, '_blank', 'noopener,noreferrer')).pipe(Effect.asVoid)
  }

  return fromPromise(() => bridge.shell.openUrl(url))
}

export function openUrl(url: string): Promise<void> {
  return runDesktopEffect(openUrlEffect(url))
}

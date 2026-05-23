import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { ref } from 'vue'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { getDesktopBridge } from './bridge'

export const updateAvailable = ref(false)
export const updateVersion = ref('')
export const updating = ref(false)

export function checkForUpdatesEffect(): DesktopEffect<boolean> {
  const bridge = getDesktopBridge()
  if (!bridge) return Effect.succeed(false)

  return Effect.gen(function* () {
    const update = yield* fromPromise(() => bridge.updater.check())
    if (!update) return false

    yield* fromSync(() => {
      updateAvailable.value = true
      updateVersion.value = update.version
    })
    return true
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))
}

export function checkForUpdates(): Promise<boolean> {
  return runDesktopEffect(checkForUpdatesEffect())
}

export function installUpdateEffect(): DesktopEffect<void> {
  const bridge = getDesktopBridge()
  if (!bridge) return Effect.void

  return Effect.gen(function* () {
    yield* fromSync(() => {
      updating.value = true
    })
    yield* fromPromise(() => bridge.updater.install())
  }).pipe(Effect.ensuring(Effect.sync(() => void (updating.value = false))))
}

export function installUpdate(): Promise<void> {
  return runDesktopEffect(installUpdateEffect())
}

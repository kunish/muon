import type { Router } from 'vue-router'
import type { DesktopEffect } from './effect'
import { loadInboxEventContext } from '@matrix/index'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopEffect } from './effect'

/**
 * Preload event context and navigate to the DM room with focus on the event.
 * If preloading fails, navigation proceeds anyway (graceful degradation).
 */
export function preloadAndNavigate(router: Router, roomId: string, eventId: string, tag = 'ContextPreload') {
  return runDesktopEffect(preloadAndNavigateEffect(router, roomId, eventId, tag))
}

export function preloadAndNavigateEffect(
  router: Router,
  roomId: string,
  eventId: string,
  tag = 'ContextPreload',
): DesktopEffect<void> {
  return Effect.gen(function* () {
    yield* fromPromise(() => loadInboxEventContext(roomId, eventId)).pipe(
      Effect.catchAll((error) =>
        fromSync(() => console.warn(`[${tag}] context preload failed, fallback to direct navigation`, error)),
      ),
    )

    yield* fromPromise(() =>
      router.push({
        path: `/dm/${encodeURIComponent(roomId)}`,
        query: { focusEventId: eventId },
      }),
    )
  })
}

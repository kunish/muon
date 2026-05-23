import type { Router } from 'vue-router'
import { loadInboxEventContext } from '@matrix/index'

/**
 * Preload event context and navigate to the DM room with focus on the event.
 * If preloading fails, navigation proceeds anyway (graceful degradation).
 */
export async function preloadAndNavigate(router: Router, roomId: string, eventId: string, tag = 'ContextPreload') {
  try {
    await loadInboxEventContext(roomId, eventId)
  } catch (error) {
    console.warn(`[${tag}] context preload failed, fallback to direct navigation`, error)
  }

  await router.push({
    path: `/dm/${encodeURIComponent(roomId)}`,
    query: { focusEventId: eventId },
  })
}

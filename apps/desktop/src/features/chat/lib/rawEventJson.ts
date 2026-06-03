import type { MatrixEvent } from 'matrix-js-sdk'
import { safeJsonStringify } from '@/shared/lib/utils'

/**
 * Build the canonical pretty-printed JSON for a Matrix timeline event.
 *
 * Single source of truth shared by the "view raw" dialog and the
 * "copy raw JSON" context-menu action so both surfaces emit identical
 * payloads. Each field is serialized defensively — a getter that throws
 * is rendered as an inline error marker instead of aborting the whole dump.
 */
export function buildRawEventJson(event: MatrixEvent): string {
  const parts: string[] = []

  const addField = (key: string, getter: () => unknown) => {
    try {
      parts.push(`  "${key}": ${safeJsonStringify(getter())}`)
    } catch (e) {
      parts.push(`  "${key}": "[Error: ${e instanceof Error ? e.message : 'unknown'}]"`)
    }
  }

  addField('event_id', () => event.getId())
  addField('type', () => event.getType())
  addField('sender', () => event.getSender())
  addField('room_id', () => event.getRoomId())
  addField('state_key', () => event.getStateKey())
  addField('origin_server_ts', () => event.getTs())
  addField('content', () => event.getContent())
  addField('unsigned', () => event.getUnsigned())
  addField('redacted_because', () => event.getUnsigned()?.redacted_because ?? null)

  return `{\n${parts.join(',\n')}\n}`
}

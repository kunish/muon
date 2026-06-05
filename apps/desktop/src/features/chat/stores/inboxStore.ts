import type { InboxFilterType } from '../types/unifiedInbox'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Store } from '@tanstack/vue-store'
import { Effect } from 'effect'
import { fromSync, runDesktopSync } from '@/shared/lib/effect'
import { INBOX_PROCESSED_STORAGE_KEY } from '../types/unifiedInbox'

// ---------------------------------------------------------------------------
// localStorage helpers (kept as-is — self-contained Effect wrappers)
// ---------------------------------------------------------------------------

function loadProcessedIds(): Set<string> {
  return runDesktopSync(loadProcessedIdsEffect())
}

function loadProcessedIdsEffect(): DesktopEffect<Set<string>> {
  return fromSync(() => {
    const raw = localStorage.getItem(INBOX_PROCESSED_STORAGE_KEY)
    if (!raw) return new Set<string>()
    const parsed = JSON.parse(raw) as { processedIds?: unknown }
    return new Set(
      Array.isArray(parsed.processedIds)
        ? parsed.processedIds.filter((id): id is string => typeof id === 'string')
        : [],
    )
  }).pipe(Effect.catchAll(() => Effect.succeed(new Set<string>())))
}

function persistProcessedIds(ids: Set<string>) {
  runDesktopSync(persistProcessedIdsEffect(ids))
}

function persistProcessedIdsEffect(ids: Set<string>): DesktopEffect<void> {
  return fromSync(() =>
    localStorage.setItem(INBOX_PROCESSED_STORAGE_KEY, JSON.stringify({ processedIds: [...ids] })),
  ).pipe(Effect.catchAll(() => Effect.void))
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface InboxState {
  filter: InboxFilterType
  selectedItemIds: Set<string>
  processedItemIds: Set<string>
  hydrated: boolean
}

function createInitialState(): InboxState {
  return {
    filter: 'all',
    selectedItemIds: new Set(),
    processedItemIds: new Set(),
    hydrated: false,
  }
}

export const inboxStore = new Store<InboxState>(createInitialState())

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function setFilter(next: InboxFilterType): void {
  inboxStore.setState((s) => ({ ...s, filter: next }))
}

export function toggleSelection(id: string): void {
  inboxStore.setState((s) => {
    const next = new Set(s.selectedItemIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { ...s, selectedItemIds: next }
  })
}

export function selectAll(ids: string[]): void {
  inboxStore.setState((s) => ({ ...s, selectedItemIds: new Set(ids) }))
}

export function clearSelection(): void {
  inboxStore.setState((s) => ({ ...s, selectedItemIds: new Set() }))
}

export function isSelected(id: string): boolean {
  return inboxStore.state.selectedItemIds.has(id)
}

export function markProcessed(id: string): void {
  inboxStore.setState((s) => {
    const next = new Set(s.processedItemIds)
    next.add(id)
    return { ...s, processedItemIds: next }
  })
  persistProcessedIds(inboxStore.state.processedItemIds)
}

export function markProcessedBatch(ids: string[]): void {
  inboxStore.setState((s) => {
    const next = new Set(s.processedItemIds)
    for (const id of ids) next.add(id)
    return { ...s, processedItemIds: next }
  })
  persistProcessedIds(inboxStore.state.processedItemIds)
}

export function markSelectedProcessed(): void {
  if (inboxStore.state.selectedItemIds.size === 0) return
  inboxStore.setState((s) => {
    const processed = new Set(s.processedItemIds)
    for (const id of s.selectedItemIds) processed.add(id)
    return { ...s, processedItemIds: processed, selectedItemIds: new Set() }
  })
  persistProcessedIds(inboxStore.state.processedItemIds)
}

export function isProcessed(id: string): boolean {
  return inboxStore.state.processedItemIds.has(id)
}

export function clearProcessed(): void {
  inboxStore.setState((s) => ({ ...s, processedItemIds: new Set() }))
  persistProcessedIds(inboxStore.state.processedItemIds)
}

export function hydrateProcessed(): void {
  if (inboxStore.state.hydrated) return
  inboxStore.setState((s) => ({
    ...s,
    processedItemIds: new Set(loadProcessedIds()),
    hydrated: true,
  }))
}

export function resetInboxStore(): void {
  inboxStore.setState(() => createInitialState())
}

// ---------------------------------------------------------------------------
// Module-load hydration (once)
// ---------------------------------------------------------------------------

hydrateProcessed()

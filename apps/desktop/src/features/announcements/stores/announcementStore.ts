import type { Announcement } from '../types/announcement'
import { Store } from '@tanstack/vue-store'
import { ANNOUNCEMENTS_STORAGE_KEY, generateAnnouncementId, isValidAnnouncement } from '../types/announcement'

interface PersistedAnnouncementState {
  version: 1
  announcements: Announcement[]
}

interface LoadedAnnouncementState {
  announcements: Announcement[]
  normalized: boolean
}

interface AddAnnouncementInput {
  id?: string
  title: string
  body: string
  author?: string
  pinned?: boolean
  read?: boolean
  now?: number
}

function normalizePersistedAnnouncements(announcements: unknown[]): LoadedAnnouncementState {
  const deduped = new Map<string, Announcement>()
  let normalized = false

  for (const announcement of announcements) {
    if (!isValidAnnouncement(announcement)) {
      normalized = true
      continue
    }
    if (deduped.has(announcement.id)) normalized = true
    deduped.set(announcement.id, announcement)
  }

  return { announcements: [...deduped.values()], normalized }
}

function loadState(): LoadedAnnouncementState {
  try {
    const raw = localStorage.getItem(ANNOUNCEMENTS_STORAGE_KEY)
    if (!raw) return { announcements: [], normalized: false }

    const parsed = JSON.parse(raw) as Partial<PersistedAnnouncementState>
    if (parsed.version !== 1 || !Array.isArray(parsed.announcements)) return { announcements: [], normalized: false }

    return normalizePersistedAnnouncements(parsed.announcements)
  } catch {
    return { announcements: [], normalized: false }
  }
}

function persistAnnouncements(announcements: Announcement[]): void {
  const payload: PersistedAnnouncementState = { version: 1, announcements }
  try {
    localStorage.setItem(ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn('[announcementStore] Failed to persist announcements:', err)
  }
}

export interface AnnouncementState {
  announcements: Announcement[]
  hydrated: boolean
}

function createInitialState(): AnnouncementState {
  const { announcements, normalized } = loadState()
  if (normalized) persistAnnouncements(announcements)
  return { announcements, hydrated: true }
}

export const announcementStore = new Store<AnnouncementState>(createInitialState())

export function selectAnnouncements(state: AnnouncementState): Announcement[] {
  return state.announcements
}

export function hydrate(): void {
  const { announcements, normalized } = loadState()
  announcementStore.setState((s) => ({ ...s, announcements, hydrated: true }))
  if (normalized) persistAnnouncements(announcements)
}

function commit(announcements: Announcement[]): void {
  announcementStore.setState((s) => ({ ...s, announcements }))
  persistAnnouncements(announcementStore.state.announcements)
}

function mapAnnouncement(id: string, fn: (announcement: Announcement) => Announcement): void {
  commit(announcementStore.state.announcements.map((item) => (item.id === id ? fn(item) : item)))
}

export function addAnnouncement(input: AddAnnouncementInput): Announcement {
  const title = input.title.trim()
  if (!title) throw new Error('Announcement title is required')

  const now = input.now ?? Date.now()
  const announcement: Announcement = {
    id: input.id ?? generateAnnouncementId(now),
    title,
    body: input.body.trim(),
    author: input.author?.trim() || '我',
    pinned: input.pinned ?? false,
    read: input.read ?? false,
    createdAt: now,
  }
  if (!isValidAnnouncement(announcement)) throw new Error('Invalid announcement')

  commit([announcement, ...announcementStore.state.announcements])
  return announcement
}

export function updateAnnouncement(id: string, patch: Partial<Pick<Announcement, 'title' | 'body'>>): void {
  mapAnnouncement(id, (announcement) => ({
    ...announcement,
    ...(patch.title !== undefined ? { title: patch.title.trim() || announcement.title } : {}),
    ...(patch.body !== undefined ? { body: patch.body.trim() } : {}),
  }))
}

export function togglePin(id: string): void {
  mapAnnouncement(id, (announcement) => ({ ...announcement, pinned: !announcement.pinned }))
}

export function markRead(id: string): void {
  const announcement = announcementStore.state.announcements.find((item) => item.id === id)
  if (!announcement || announcement.read) return
  mapAnnouncement(id, (item) => ({ ...item, read: true }))
}

export function markAllRead(): void {
  if (announcementStore.state.announcements.every((item) => item.read)) return
  commit(announcementStore.state.announcements.map((item) => (item.read ? item : { ...item, read: true })))
}

export function removeAnnouncement(id: string): void {
  const next = announcementStore.state.announcements.filter((item) => item.id !== id)
  if (next.length === announcementStore.state.announcements.length) return
  commit(next)
}

export function resetAnnouncementStore(): void {
  announcementStore.setState(() => createInitialState())
}

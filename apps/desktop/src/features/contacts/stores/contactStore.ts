import type { ContactProfileState } from '../types'
import { Store } from '@tanstack/vue-store'
import { DEFAULT_CONTACT_PROFILE } from '../types'

export type { Contact, ContactProfileState, GroupInfo } from '../types'

const CONTACT_PROFILES_STORAGE_KEY = 'muon.contacts.profiles.v1'

interface PersistedContactProfiles {
  version: 1
  profiles: Record<string, ContactProfileState>
}

function isValidContactProfile(value: unknown): value is ContactProfileState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ContactProfileState>
  return (
    typeof candidate.isBlocked === 'boolean' &&
    typeof candidate.isFavorite === 'boolean' &&
    typeof candidate.note === 'string' &&
    typeof candidate.tag === 'string'
  )
}

function loadProfiles(): Record<string, ContactProfileState> {
  try {
    const raw = localStorage.getItem(CONTACT_PROFILES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<PersistedContactProfiles>
    if (parsed.version !== 1 || !parsed.profiles || typeof parsed.profiles !== 'object') return {}
    const result: Record<string, ContactProfileState> = {}
    for (const [userId, profile] of Object.entries(parsed.profiles)) {
      if (isValidContactProfile(profile)) result[userId] = profile
    }
    return result
  } catch {
    return {}
  }
}

function persistProfiles(profiles: Record<string, ContactProfileState>): void {
  const payload: PersistedContactProfiles = { version: 1, profiles }
  try {
    localStorage.setItem(CONTACT_PROFILES_STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn('[contactStore] Failed to persist profiles:', err)
  }
}

export interface ContactClientState {
  searchQuery: string
  selectedContactId: string | null
  contactProfiles: Record<string, ContactProfileState>
}

function createInitialState(): ContactClientState {
  return {
    searchQuery: '',
    selectedContactId: null,
    contactProfiles: loadProfiles(),
  }
}

export const contactStore = new Store<ContactClientState>(createInitialState())

export function setSearchQuery(query: string) {
  contactStore.setState((prev) => ({ ...prev, searchQuery: query }))
}

export function selectContact(userId: string | null) {
  contactStore.setState((prev) => ({ ...prev, selectedContactId: userId }))
}

/** Pure lookup with the default fallback — safe for reactive derivations from a `useSelector` snapshot. */
export function getContactProfile(profiles: Record<string, ContactProfileState>, userId: string): ContactProfileState {
  return profiles[userId] ?? DEFAULT_CONTACT_PROFILE
}

/** Imperative snapshot read (non-reactive) for one-shot reads in actions/watches. */
export function contactProfileFor(userId: string): ContactProfileState {
  return getContactProfile(contactStore.state.contactProfiles, userId)
}

export function updateContactProfile(userId: string, patch: Partial<ContactProfileState>) {
  contactStore.setState((prev) => ({
    ...prev,
    contactProfiles: {
      ...prev.contactProfiles,
      [userId]: { ...DEFAULT_CONTACT_PROFILE, ...prev.contactProfiles[userId], ...patch },
    },
  }))
  // setState is synchronous, so the snapshot already holds the merged profiles.
  persistProfiles(contactStore.state.contactProfiles)
}

export function toggleContactFavorite(userId: string) {
  updateContactProfile(userId, { isFavorite: !contactProfileFor(userId).isFavorite })
}

export function toggleContactBlocked(userId: string) {
  updateContactProfile(userId, { isBlocked: !contactProfileFor(userId).isBlocked })
}

export function resetContactStore() {
  contactStore.setState(() => createInitialState())
}

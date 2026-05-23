/**
 * Shared contact-list data facade.
 *
 * Cross-feature consumers (chat, organization) read the contact list through
 * this composable instead of importing the contacts feature store directly.
 * The Pinia store remains the single source of truth for the contacts feature
 * while other features only depend on this thin shared contract.
 *
 * Reactive properties are exposed via getters that delegate to the Pinia
 * store so consumers see live updates without importing the store directly.
 */
import { useContactStore } from '@/features/contacts/stores/contactStore'

export function useContactList() {
  const store = useContactStore()

  function ensureContactsLoaded() {
    if (store.contacts.length === 0) {
      void store.loadContacts().catch(() => {})
    }
  }

  function ensureGroupsLoaded() {
    if (store.groups.length === 0) {
      void store.loadGroups().catch(() => {})
    }
  }

  return {
    /** Reactive — delegates to the Pinia store getter on every access. */
    get contacts() { return store.contacts },
    /** Reactive — delegates to the Pinia store getter on every access. */
    get groups() { return store.groups },
    loadContacts: store.loadContacts,
    loadGroups: store.loadGroups,
    ensureContactsLoaded,
    ensureGroupsLoaded,
  }
}

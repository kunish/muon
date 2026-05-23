import { Effect } from 'effect'
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
import { fromPromise, runDesktopEffect } from '@/shared/lib/effect'

export function useContactList() {
  const store = useContactStore()

  function ensureContactsLoaded() {
    if (store.contacts.length === 0) {
      void runDesktopEffect(fromPromise(() => store.loadContacts()).pipe(Effect.catchAll(() => Effect.void)))
    }
  }

  function ensureGroupsLoaded() {
    if (store.groups.length === 0) {
      void runDesktopEffect(fromPromise(() => store.loadGroups()).pipe(Effect.catchAll(() => Effect.void)))
    }
  }

  return {
    /** Reactive — delegates to the Pinia store getter on every access. */
    get contacts() {
      return store.contacts
    },
    /** Reactive — delegates to the Pinia store getter on every access. */
    get groups() {
      return store.groups
    },
    loadContacts: store.loadContacts,
    loadGroups: store.loadGroups,
    ensureContactsLoaded,
    ensureGroupsLoaded,
  }
}

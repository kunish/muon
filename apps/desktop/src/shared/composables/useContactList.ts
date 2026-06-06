/**
 * Shared contact-list data facade.
 *
 * Cross-feature consumers (chat, organization, projects, approvals, calendar,
 * email) read the contact list through this composable instead of importing the
 * contacts feature internals directly. The facade now backs onto the
 * `@tanstack/vue-query` contacts/groups queries; its shape is unchanged so those
 * consumers need no edits.
 *
 * The queries auto-fetch on first use (keyed + deduped across all consumers), so
 * `ensureContactsLoaded`/`ensureGroupsLoaded` are kept only for API
 * compatibility and are no-ops — loading happens on mount.
 */
import { useContactsQuery, useGroupsQuery } from '@/features/contacts/queries/useContacts'

export function useContactList() {
  const contactsQuery = useContactsQuery()
  const groupsQuery = useGroupsQuery()

  function ensureContactsLoaded() {}
  function ensureGroupsLoaded() {}

  return {
    /** Reactive — delegates to the query's data on every access. */
    get contacts() {
      return contactsQuery.contacts.value
    },
    /** Reactive — delegates to the query's data on every access. */
    get groups() {
      return groupsQuery.groups.value
    },
    loadContacts: () => contactsQuery.refetch(),
    loadGroups: () => groupsQuery.refetch(),
    ensureContactsLoaded,
    ensureGroupsLoaded,
  }
}

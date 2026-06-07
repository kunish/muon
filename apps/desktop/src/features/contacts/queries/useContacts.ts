import { useQuery } from '@tanstack/vue-query'
import { contactKeys } from './contactKeys'
import { loadContacts, loadGroups } from './contactsApi'

export function useContactsQuery() {
  const query = useQuery({
    queryKey: contactKeys.list(),
    queryFn: loadContacts,
  })
  const contacts = computed(() => query.data.value ?? [])
  // Spread the full query so callers can reach refetch/isError; `contacts` is a
  // convenience computed so call sites avoid `data.value ?? []`.
  return { ...query, contacts }
}

export function useGroupsQuery() {
  const query = useQuery({
    queryKey: contactKeys.groups(),
    queryFn: loadGroups,
  })
  const groups = computed(() => query.data.value ?? [])
  return { ...query, groups }
}

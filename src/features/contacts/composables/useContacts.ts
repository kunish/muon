import { getClient } from '@matrix/client'

export function useContacts() {
  async function searchUsers(term: string) {
    const client = getClient()
    const { results } = await client.searchUserDirectory({ term, limit: 20 })
    return results
  }

  return { searchUsers }
}

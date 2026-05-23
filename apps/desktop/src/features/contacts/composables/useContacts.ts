import type { DesktopEffect } from '@/shared/lib/effect'
import { getClient } from '@matrix/client'
import { Effect } from 'effect'
import { fromPromise, runDesktopEffect } from '@/shared/lib/effect'

export function useContacts() {
  function searchUsersEffect(
    term: string,
  ): DesktopEffect<Awaited<ReturnType<ReturnType<typeof getClient>['searchUserDirectory']>>['results']> {
    const client = getClient()
    return Effect.gen(function* () {
      const { results } = yield* fromPromise(() => client.searchUserDirectory({ term, limit: 20 }))
      return results
    })
  }

  function searchUsers(term: string) {
    return runDesktopEffect(searchUsersEffect(term))
  }

  return { searchUsersEffect, searchUsers }
}

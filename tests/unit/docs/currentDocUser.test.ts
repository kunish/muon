import { describe, expect, it, vi } from 'vitest'
import { resolveCurrentDocUser } from '@/features/docs/lib/currentDocUser'
import { userColor } from '@/features/docs/types/doc'

type DocUserClient = NonNullable<Parameters<typeof resolveCurrentDocUser>[1]>

function createClient(userId: string | null, displayName: string | null): DocUserClient {
  return {
    getUserId: vi.fn(() => userId),
    getUser: vi.fn(() => displayName ? ({ displayName }) : null),
  } as unknown as DocUserClient
}

describe('currentDocUser', () => {
  it('uses the Matrix user id and profile display name for doc collaboration identity', () => {
    const client = createClient('@alice:localhost', 'Alice')

    expect(resolveCurrentDocUser(undefined, client)).toEqual({
      id: '@alice:localhost',
      name: 'Alice',
      color: userColor('@alice:localhost'),
    })
  })

  it('lets an explicit editor user name override the Matrix profile name', () => {
    const client = createClient('@alice:localhost', 'Alice')

    expect(resolveCurrentDocUser('我', client)).toMatchObject({
      id: '@alice:localhost',
      name: '我',
    })
  })

  it('falls back to a local identity when the Matrix user is unavailable', () => {
    const client = createClient(null, null)

    expect(resolveCurrentDocUser(undefined, client)).toEqual({
      id: 'current-user',
      name: 'current-user',
      color: userColor('current-user'),
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockClient } from '../../mocks/matrix'

describe('matrix blocking', () => {
  const mockGetContent = vi.fn().mockReturnValue({ ignored_users: {} })

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetContent.mockReturnValue({ ignored_users: {} })
    vi.mocked(mockClient.getAccountData).mockImplementation((type: string) => {
      if (type === 'm.ignored_user_list') {
        return { getContent: mockGetContent } as any
      }
      return null
    })
  })

  describe('getBlockedUsers', () => {
    it('should return an empty list when no users are blocked', async () => {
      mockGetContent.mockReturnValue({})
      const { getBlockedUsers } = await import('@/matrix/blocking')
      const blocked = getBlockedUsers()
      expect(blocked).toEqual([])
    })

    it('should return a list of blocked user IDs', async () => {
      mockGetContent.mockReturnValue({
        ignored_users: {
          '@spammer:localhost': {},
          '@troll:localhost': {},
        },
      })
      const { getBlockedUsers } = await import('@/matrix/blocking')
      const blocked = getBlockedUsers()
      expect(blocked).toEqual(['@spammer:localhost', '@troll:localhost'])
    })

    it('should handle null account data event gracefully', async () => {
      vi.mocked(mockClient.getAccountData).mockReturnValue(null as any)
      const { getBlockedUsers } = await import('@/matrix/blocking')
      const blocked = getBlockedUsers()
      expect(blocked).toEqual([])
    })
  })

  describe('isUserBlocked', () => {
    it('should return true when user is in the ignored list', async () => {
      mockGetContent.mockReturnValue({
        ignored_users: { '@spammer:localhost': {} },
      })
      const { isUserBlocked } = await import('@/matrix/blocking')
      expect(isUserBlocked('@spammer:localhost')).toBe(true)
    })

    it('should return false when user is not in the ignored list', async () => {
      mockGetContent.mockReturnValue({
        ignored_users: { '@spammer:localhost': {} },
      })
      const { isUserBlocked } = await import('@/matrix/blocking')
      expect(isUserBlocked('@friend:localhost')).toBe(false)
    })
  })

  describe('blockUser', () => {
    it('should add a user to the ignored list', async () => {
      mockGetContent.mockReturnValue({
        ignored_users: { '@spammer:localhost': {} },
      })
      const { blockUser } = await import('@/matrix/blocking')
      await blockUser('@troll:localhost')

      expect(mockClient.setAccountData).toHaveBeenCalledWith(
        'm.ignored_user_list',
        {
          ignored_users: {
            '@spammer:localhost': {},
            '@troll:localhost': {},
          },
        },
      )
    })

    it('should not duplicate a user already in the ignored list', async () => {
      mockGetContent.mockReturnValue({
        ignored_users: { '@spammer:localhost': {} },
      })
      const { blockUser } = await import('@/matrix/blocking')
      await blockUser('@spammer:localhost')

      expect(mockClient.setAccountData).not.toHaveBeenCalled()
    })

    it('should block first user when list was previously empty', async () => {
      mockGetContent.mockReturnValue({})
      const { blockUser } = await import('@/matrix/blocking')
      await blockUser('@first:localhost')

      expect(mockClient.setAccountData).toHaveBeenCalledWith(
        'm.ignored_user_list',
        {
          ignored_users: { '@first:localhost': {} },
        },
      )
    })
  })

  describe('unblockUser', () => {
    it('should remove a user from the ignored list', async () => {
      mockGetContent.mockReturnValue({
        ignored_users: {
          '@spammer:localhost': {},
          '@troll:localhost': {},
        },
      })
      const { unblockUser } = await import('@/matrix/blocking')
      await unblockUser('@spammer:localhost')

      expect(mockClient.setAccountData).toHaveBeenCalledWith(
        'm.ignored_user_list',
        {
          ignored_users: { '@troll:localhost': {} },
        },
      )
    })

    it('should not fail when unblocking a user not in the list', async () => {
      mockGetContent.mockReturnValue({
        ignored_users: { '@spammer:localhost': {} },
      })
      const { unblockUser } = await import('@/matrix/blocking')
      await unblockUser('@unknown:localhost')

      expect(mockClient.setAccountData).toHaveBeenCalledWith(
        'm.ignored_user_list',
        {
          ignored_users: { '@spammer:localhost': {} },
        },
      )
    })
  })
})

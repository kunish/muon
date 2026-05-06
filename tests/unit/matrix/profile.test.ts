import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockClient } from '../../mocks/matrix'

describe('matrix profile', () => {
  const mockUser = {
    displayName: 'TestDisplay',
    avatarUrl: 'mxc://localhost/avatar',
    presence: 'online' as const,
    presenceStatusMsg: 'Busy coding',
    lastActiveAgo: 120,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockClient.getUserId).mockReturnValue('@test:localhost')
    vi.mocked(mockClient.getUser).mockReturnValue(mockUser as any)
  })

  describe('getMyDisplayName', () => {
    it('should return the display name when it is set', async () => {
      const { getMyDisplayName } = await import('@/matrix/profile')
      const name = getMyDisplayName()
      expect(name).toBe('TestDisplay')
    })

    it('should fall back to userId when displayName is missing', async () => {
      vi.mocked(mockClient.getUser).mockReturnValue({ displayName: undefined, avatarUrl: undefined } as any)
      const { getMyDisplayName } = await import('@/matrix/profile')
      const name = getMyDisplayName()
      expect(name).toBe('@test:localhost')
    })

    it('should return empty string when userId is null', async () => {
      vi.mocked(mockClient.getUserId).mockReturnValue(null)
      const { getMyDisplayName } = await import('@/matrix/profile')
      const name = getMyDisplayName()
      expect(name).toBe('')
    })
  })

  describe('getMyAvatarUrl', () => {
    it('should return the avatar URL when it is set', async () => {
      const { getMyAvatarUrl } = await import('@/matrix/profile')
      const url = getMyAvatarUrl()
      expect(url).toBe('mxc://localhost/avatar')
    })

    it('should return undefined when no userId is available', async () => {
      vi.mocked(mockClient.getUserId).mockReturnValue(null)
      const { getMyAvatarUrl } = await import('@/matrix/profile')
      const url = getMyAvatarUrl()
      expect(url).toBeUndefined()
    })

    it('should return undefined when avatarUrl is not set', async () => {
      vi.mocked(mockClient.getUser).mockReturnValue({ displayName: 'Test', avatarUrl: undefined } as any)
      const { getMyAvatarUrl } = await import('@/matrix/profile')
      const url = getMyAvatarUrl()
      expect(url).toBeUndefined()
    })
  })

  describe('setMyDisplayName', () => {
    it('should call setDisplayName on the client', async () => {
      const { setMyDisplayName } = await import('@/matrix/profile')
      await setMyDisplayName('New Name')
      expect(mockClient.setDisplayName).toHaveBeenCalledWith('New Name')
    })
  })

  describe('setMyAvatar', () => {
    it('should upload content and set the avatar URL', async () => {
      const mockFile = new File(['mock'], 'avatar.png', { type: 'image/png' })
      vi.mocked(mockClient.uploadContent).mockResolvedValue({ content_uri: 'mxc://localhost/new_avatar' } as any)
      vi.mocked(mockClient.setAvatarUrl).mockResolvedValue(undefined)

      const { setMyAvatar } = await import('@/matrix/profile')
      await setMyAvatar(mockFile)

      expect(mockClient.uploadContent).toHaveBeenCalledWith(mockFile)
      expect(mockClient.setAvatarUrl).toHaveBeenCalledWith('mxc://localhost/new_avatar')
    })
  })

  describe('setMyStatus / getMyStatus / clearMyStatus', () => {
    it('should set the user status message', async () => {
      const { setMyStatus } = await import('@/matrix/profile')
      await setMyStatus('In a meeting')

      expect(mockClient.setPresence).toHaveBeenCalledWith({
        presence: 'online',
        status_msg: 'In a meeting',
      })
    })

    it('should get the current status message', async () => {
      const { getMyStatus } = await import('@/matrix/profile')
      const status = getMyStatus()

      expect(status).toBe('Busy coding')
    })

    it('should return empty string when userId is null', async () => {
      vi.mocked(mockClient.getUserId).mockReturnValue(null)
      const { getMyStatus } = await import('@/matrix/profile')
      const status = getMyStatus()
      expect(status).toBe('')
    })

    it('should return empty string when presenceStatusMsg is missing', async () => {
      vi.mocked(mockClient.getUser).mockReturnValue({ displayName: 'Test', presenceStatusMsg: undefined } as any)
      const { getMyStatus } = await import('@/matrix/profile')
      const status = getMyStatus()
      expect(status).toBe('')
    })

    it('should clear the status message', async () => {
      const { clearMyStatus } = await import('@/matrix/profile')
      await clearMyStatus()

      expect(mockClient.setPresence).toHaveBeenCalledWith({
        presence: 'online',
        status_msg: '',
      })
    })
  })

  describe('getUserPresenceInfo', () => {
    it('should return presence info for a given user', async () => {
      const { getUserPresenceInfo } = await import('@/matrix/profile')
      const info = getUserPresenceInfo('@alice:localhost')

      expect(info).toEqual({
        presence: 'online',
        lastActiveAgo: 120,
        statusMsg: 'Busy coding',
      })
    })

    it('should return offline when user is not found', async () => {
      vi.mocked(mockClient.getUser).mockReturnValue(null as any)
      const { getUserPresenceInfo } = await import('@/matrix/profile')
      const info = getUserPresenceInfo('@unknown:localhost')

      expect(info).toEqual({ presence: 'offline' })
    })

    it('should return offline when client.getUser throws', async () => {
      vi.mocked(mockClient.getUser).mockImplementation(() => {
        throw new Error('User not in local store')
      })
      const { getUserPresenceInfo } = await import('@/matrix/profile')
      const info = getUserPresenceInfo('@error:localhost')

      expect(info).toEqual({ presence: 'offline' })
    })
  })
})

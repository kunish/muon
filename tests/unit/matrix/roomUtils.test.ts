import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockClient } from '../../mocks/matrix'

describe('matrix roomUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isDirectRoom', () => {
    it('should return true when the room is in the m.direct account data', async () => {
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({
          '@alice:localhost': ['!dm_alice:localhost'],
          '@bob:localhost': ['!dm_bob:localhost'],
        }),
      } as any)

      const { isDirectRoom } = await import('@/matrix/roomUtils')
      expect(isDirectRoom('!dm_alice:localhost')).toBe(true)
    })

    it('should return false when the room is not a DM', async () => {
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({
          '@alice:localhost': ['!dm_alice:localhost'],
        }),
      } as any)

      const { isDirectRoom } = await import('@/matrix/roomUtils')
      expect(isDirectRoom('!group_project:localhost')).toBe(false)
    })

    it('should handle missing account data gracefully', async () => {
      vi.mocked(mockClient.getAccountData).mockReturnValue(null as any)

      const { isDirectRoom } = await import('@/matrix/roomUtils')
      expect(isDirectRoom('!any:localhost')).toBe(false)
    })
  })

  describe('normalizeRoomId', () => {
    it('should decode URI-encoded room IDs', async () => {
      const { normalizeRoomId } = await import('@/matrix/roomUtils')
      expect(normalizeRoomId('!room%20name%3Alocalhost')).toBe('!room name:localhost')
    })

    it('should return the original string if not URI-encoded', async () => {
      const { normalizeRoomId } = await import('@/matrix/roomUtils')
      expect(normalizeRoomId('!room:localhost')).toBe('!room:localhost')
    })

    it('should return null for null input', async () => {
      const { normalizeRoomId } = await import('@/matrix/roomUtils')
      expect(normalizeRoomId(null)).toBeNull()
    })

    it('should return null for undefined input', async () => {
      const { normalizeRoomId } = await import('@/matrix/roomUtils')
      expect(normalizeRoomId(undefined)).toBeNull()
    })

    it('should return null for empty string', async () => {
      const { normalizeRoomId } = await import('@/matrix/roomUtils')
      expect(normalizeRoomId('')).toBeNull()
    })

    it('should return the id unchanged when decodeURIComponent throws', async () => {
      // %E0%A4%A is malformed UTF-8 — decodeURIComponent will throw
      const malformed = '%E0%A4%A'
      const { normalizeRoomId } = await import('@/matrix/roomUtils')
      expect(normalizeRoomId(malformed)).toBe(malformed)
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockClient } from '../../mocks/matrix'

describe('matrix crypto', () => {
  let mockCrypto: { setTrustCrossSignedDevices: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCrypto = { setTrustCrossSignedDevices: vi.fn().mockResolvedValue(undefined) }
    vi.mocked(mockClient.initRustCrypto).mockResolvedValue(undefined)
    ;(mockClient as any).getCrypto = vi.fn().mockReturnValue(mockCrypto)
  })

  describe('initCrypto', () => {
    it('should initialize Rust crypto and trust cross-signed devices', async () => {
      const { initCrypto } = await import('@/matrix/crypto')
      await initCrypto()

      expect(mockClient.initRustCrypto).toHaveBeenCalledOnce()
      expect(mockCrypto.setTrustCrossSignedDevices).toHaveBeenCalledWith(true)
    })

    it('should not call setTrustCrossSignedDevices when crypto is not available', async () => {
      ;(mockClient as any).getCrypto = vi.fn().mockReturnValue(null)

      const { initCrypto } = await import('@/matrix/crypto')
      await initCrypto()

      expect(mockClient.initRustCrypto).toHaveBeenCalledOnce()
      expect(mockCrypto.setTrustCrossSignedDevices).not.toHaveBeenCalled()
    })
  })

  describe('createEncryptedRoom', () => {
    it('should create an encrypted room with invited users', async () => {
      vi.mocked(mockClient.createRoom).mockResolvedValue({ room_id: '!encrypted:localhost' } as any)

      const { createEncryptedRoom } = await import('@/matrix/crypto')
      const roomId = await createEncryptedRoom('Secret Chat', ['@alice:localhost', '@bob:localhost'])

      expect(mockClient.createRoom).toHaveBeenCalledWith({
        name: 'Secret Chat',
        invite: ['@alice:localhost', '@bob:localhost'],
        initial_state: [
          {
            type: 'm.room.encryption',
            content: { algorithm: 'm.megolm.v1.aes-sha2' },
          },
        ],
        preset: 'private_chat',
      })
      expect(roomId).toBe('!encrypted:localhost')
    })

    it('should create an encrypted room without any invitations', async () => {
      vi.mocked(mockClient.createRoom).mockResolvedValue({ room_id: '!solo:localhost' } as any)

      const { createEncryptedRoom } = await import('@/matrix/crypto')
      const roomId = await createEncryptedRoom('Solo Vault', [])

      expect(mockClient.createRoom).toHaveBeenCalledWith({
        name: 'Solo Vault',
        invite: [],
        initial_state: [
          {
            type: 'm.room.encryption',
            content: { algorithm: 'm.megolm.v1.aes-sha2' },
          },
        ],
        preset: 'private_chat',
      })
      expect(roomId).toBe('!solo:localhost')
    })
  })
})

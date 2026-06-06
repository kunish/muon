import { beforeEach, describe, expect, it, vi } from 'vitest'

const setMicrophoneEnabled = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const getLiveKitToken = vi.hoisted(() => vi.fn().mockResolvedValue('voice-token'))
const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('@/features/server/lib/livekitToken', () => ({
  getLiveKitToken,
}))

vi.mock('@/matrix/client', () => ({
  getClient: () => ({
    getUser: () => ({ avatarUrl: 'mxc://localhost/me', displayName: 'Ada Chen' }),
    getUserId: () => '@ada:localhost',
  }),
}))

vi.mock('livekit-client', () => {
  class FakeRoom {
    localParticipant = {
      setMicrophoneEnabled,
    }

    private handlers = new Map<string, () => void>()

    on(event: string, handler: () => void) {
      this.handlers.set(event, handler)
      return this
    }

    async connect() {
      this.handlers.get('connected')?.()
    }

    async disconnect() {
      this.handlers.get('disconnected')?.()
    }

    removeAllListeners() {
      this.handlers.clear()
    }
  }

  return {
    Room: FakeRoom,
    RoomEvent: {
      Connected: 'connected',
      Disconnected: 'disconnected',
    },
  }
})

vi.mock('vue-sonner', () => ({
  toast: {
    error: toastMocks.error,
  },
}))

async function createVoiceChannel() {
  const { useVoiceChannel } = await import('@/features/server/composables/useVoiceChannel')
  return useVoiceChannel()
}

describe('useVoiceChannel', () => {
  beforeEach(() => {
    setMicrophoneEnabled.mockClear()
    setMicrophoneEnabled.mockResolvedValue(undefined)
    getLiveKitToken.mockClear()
    getLiveKitToken.mockResolvedValue('voice-token')
    toastMocks.error.mockClear()
    vi.resetModules()
  })

  it('keeps a manually muted microphone muted after undeafening', async () => {
    const voice = await createVoiceChannel()
    await voice.joinVoiceChannel('!voice:localhost', 'Daily Sync', '!server:localhost')

    await voice.toggleMute()
    await voice.toggleDeafen()
    await voice.toggleDeafen()

    expect(voice.isDeafened.value).toBe(false)
    expect(voice.isMuted.value).toBe(true)
    expect(setMicrophoneEnabled.mock.calls).toEqual([[true], [false]])
  })

  it('shows a localized error when joining voice fails', async () => {
    getLiveKitToken.mockRejectedValueOnce(new Error('token endpoint down'))
    const voice = await createVoiceChannel()

    await voice.joinVoiceChannel('!voice:localhost', 'Daily Sync', '!server:localhost')

    expect(toastMocks.error).toHaveBeenCalledWith('无法加入语音频道')
    expect(voice.isConnected.value).toBe(false)
    expect(voice.currentChannelId.value).toBeNull()
  })

  it('shows a localized error when microphone toggling fails', async () => {
    const voice = await createVoiceChannel()
    await voice.joinVoiceChannel('!voice:localhost', 'Daily Sync', '!server:localhost')
    setMicrophoneEnabled.mockRejectedValueOnce(new Error('device unavailable'))

    await voice.toggleMute()

    expect(toastMocks.error).toHaveBeenCalledWith('无法切换麦克风')
    expect(voice.isMuted.value).toBe(false)
  })
})

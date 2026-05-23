import { afterEach, describe, expect, it, vi } from 'vitest'
import { getLiveKitToken } from '@/features/server/lib/livekitToken'

describe('getLiveKitToken', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('requests a participant token from the configured endpoint', async () => {
    vi.stubEnv('VITE_LIVEKIT_TOKEN_ENDPOINT', 'https://token.muon.dev/livekit')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ token: 'participant-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const token = await getLiveKitToken({
      roomName: '!room:muon.dev',
      identity: '@alice:muon.dev',
      name: 'Alice',
    })

    expect(token).toBe('participant-token')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://token.muon.dev/livekit',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: '!room:muon.dev',
          identity: '@alice:muon.dev',
          name: 'Alice',
        }),
      }),
    )
  })

  it('fails before connecting when no real token source is configured', async () => {
    await expect(
      getLiveKitToken({
        roomName: '!room:muon.dev',
        identity: '@alice:muon.dev',
      }),
    ).rejects.toThrow('LiveKit token endpoint')
  })
})

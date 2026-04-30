export interface LiveKitTokenRequest {
  roomName: string
  identity: string
  name?: string
  metadata?: string
}

interface LiveKitTokenResponse {
  token?: string
  accessToken?: string
  participantToken?: string
}

export async function getLiveKitToken(request: LiveKitTokenRequest): Promise<string> {
  const tokenEndpoint = import.meta.env.VITE_LIVEKIT_TOKEN_ENDPOINT as string | undefined
  if (!tokenEndpoint) {
    throw new Error('LiveKit token endpoint is not configured. Set VITE_LIVEKIT_TOKEN_ENDPOINT to a backend endpoint that returns a participant token.')
  }

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomName: request.roomName,
      identity: request.identity,
      ...(request.name ? { name: request.name } : {}),
      ...(request.metadata ? { metadata: request.metadata } : {}),
    }),
  })

  if (!response.ok) {
    throw new Error(`LiveKit token endpoint failed with ${response.status}`)
  }

  const data = await response.json() as LiveKitTokenResponse
  const token = data.token ?? data.accessToken ?? data.participantToken
  if (!token) {
    throw new Error('LiveKit token endpoint response did not include a token')
  }
  return token
}

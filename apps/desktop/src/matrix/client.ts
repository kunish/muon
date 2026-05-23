import type { MatrixClient } from 'matrix-js-sdk'
import type { MatrixConfig } from './types'
import { createClient as sdkCreateClient } from 'matrix-js-sdk'
import { fetch as desktopFetch } from '@/desktop/http'
import { matrixClientLogger } from './logger'

let client: MatrixClient | null = null

export function matrixFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return desktopFetch(input, init)
}

function matrixClientOptions(config: MatrixConfig) {
  return {
    baseUrl: config.serverUrl,
    accessToken: config.accessToken,
    userId: config.userId,
    deviceId: config.deviceId,
    timelineSupport: true,
    fetchFn: matrixFetch as typeof globalThis.fetch,
    logger: matrixClientLogger,
    // muon 使用 LiveKit 进行通话，禁用 matrix-js-sdk 内置 VoIP 以避免无意义的 TURN 请求
    disableVoip: true,
    fallbackICEServerAllowed: false,
  }
}

export function getClient(): MatrixClient {
  if (!client) throw new Error('Matrix client not initialized')
  return client
}

export function createClient(config: MatrixConfig): MatrixClient {
  client = sdkCreateClient(matrixClientOptions(config))
  return client
}

export function createEphemeralClient(serverUrl: string): MatrixClient {
  return sdkCreateClient(matrixClientOptions({ serverUrl }))
}

export function destroyClient(): void {
  if (client) {
    client.stopClient()
    client = null
  }
}

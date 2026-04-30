import type { MatrixClient } from 'matrix-js-sdk'
import type { MatrixConfig } from './types'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { createClient as sdkCreateClient } from 'matrix-js-sdk'

let client: MatrixClient | null = null

function canUseTauriFetch(): boolean {
  return typeof window !== 'undefined'
    && typeof (window as Window & { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__?.invoke === 'function'
}

export function matrixFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!canUseTauriFetch())
    return globalThis.fetch(input, init)

  return tauriFetch(input as URL | Request | string, init)
}

export function getClient(): MatrixClient {
  if (!client)
    throw new Error('Matrix client not initialized')
  return client
}

export function createClient(config: MatrixConfig): MatrixClient {
  client = sdkCreateClient({
    baseUrl: config.serverUrl,
    accessToken: config.accessToken,
    userId: config.userId,
    deviceId: config.deviceId,
    timelineSupport: true,
    fetchFn: matrixFetch as typeof globalThis.fetch,
    // muon 使用 LiveKit 进行通话，禁用 matrix-js-sdk 内置 VoIP 以避免无意义的 TURN 请求
    disableVoip: true,
    fallbackICEServerAllowed: false,
  })
  return client
}

export function destroyClient(): void {
  if (client) {
    client.stopClient()
    client = null
  }
}

import type { MatrixClient } from 'matrix-js-sdk'
import type { MatrixConfig } from './types'
import type { DesktopEffect } from '@/shared/lib/effect'
import { createClient as sdkCreateClient } from 'matrix-js-sdk'
import { fetch as desktopFetch } from '@/desktop/http'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'
import { matrixClientLogger } from './logger'

let client: MatrixClient | null = null

export function matrixFetchEffect(input: RequestInfo | URL, init?: RequestInit): DesktopEffect<Response> {
  return fromPromise(() => desktopFetch(input, init))
}

export function matrixFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return runDesktopEffect(matrixFetchEffect(input, init))
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

export function getClientEffect(): DesktopEffect<MatrixClient> {
  return fromSync(() => {
    if (!client) throw new Error('Matrix client not initialized')
    return client
  })
}

export function getClient(): MatrixClient {
  return runDesktopSync(getClientEffect())
}

export function createClientEffect(config: MatrixConfig): DesktopEffect<MatrixClient> {
  return fromSync(() => {
    client = sdkCreateClient(matrixClientOptions(config))
    return client
  })
}

export function createClient(config: MatrixConfig): MatrixClient {
  return runDesktopSync(createClientEffect(config))
}

export function createEphemeralClientEffect(serverUrl: string): DesktopEffect<MatrixClient> {
  return fromSync(() => sdkCreateClient(matrixClientOptions({ serverUrl })))
}

export function createEphemeralClient(serverUrl: string): MatrixClient {
  return runDesktopSync(createEphemeralClientEffect(serverUrl))
}

export function destroyClientEffect(): DesktopEffect<void> {
  return fromSync(() => {
    if (client) {
      client.stopClient()
      client = null
    }
  })
}

export function destroyClient(): void {
  runDesktopSync(destroyClientEffect())
}

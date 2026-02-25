import type { MatrixConfig } from './types'
import * as sdk from 'matrix-js-sdk'

let client: sdk.MatrixClient | null = null

export function getClient(): sdk.MatrixClient {
  if (!client)
    throw new Error('Matrix client not initialized')
  return client
}

export function createClient(config: MatrixConfig): sdk.MatrixClient {
  client = sdk.createClient({
    baseUrl: config.serverUrl,
    accessToken: config.accessToken,
    userId: config.userId,
    deviceId: config.deviceId,
    timelineSupport: true,
  })
  return client
}

export function destroyClient(): void {
  if (client) {
    client.stopClient()
    client = null
  }
}

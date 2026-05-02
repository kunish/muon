import type { MatrixProvisioningAdapter, MatrixProvisioningInput, MatrixProvisioningResult } from './provisioning'
import { randomBytes } from 'node:crypto'

export interface ConduitProvisioningAdapterOptions {
  fetch?: typeof fetch
  serverUrl: string
}

function localpartFor(input: MatrixProvisioningInput): string {
  return `${input.organizationSlug}.${input.username}`.toLowerCase().replace(/[^a-z0-9._=-]/g, '_')
}

function randomPassword(): string {
  return randomBytes(24).toString('base64url')
}

export function createConduitProvisioningAdapter(options: ConduitProvisioningAdapterOptions): MatrixProvisioningAdapter {
  const fetchImpl = options.fetch ?? fetch

  return {
    async ensureUser(input): Promise<MatrixProvisioningResult> {
      const username = localpartFor(input)
      const password = randomPassword()
      const response = await fetchImpl(`${options.serverUrl}/_matrix/client/v3/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          initial_device_display_name: 'Muon Desktop',
          auth: { type: 'm.login.dummy' },
        }),
      })
      const payload = await response.json() as {
        access_token?: string
        device_id?: string
        errcode?: string
        user_id?: string
      }

      if (!response.ok) {
        if (payload.errcode === 'M_USER_IN_USE') {
          throw new Error('Matrix account already exists outside Muon provisioning')
        }
        throw new Error('Matrix provisioning failed')
      }

      if (!payload.user_id || !payload.access_token || !payload.device_id)
        throw new Error('Matrix provisioning returned an incomplete session')

      return {
        matrixUserId: payload.user_id,
        accessToken: payload.access_token,
        deviceId: payload.device_id,
      }
    },
  }
}

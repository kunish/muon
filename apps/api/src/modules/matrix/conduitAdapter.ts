import type { MatrixProvisioningAdapter, MatrixProvisioningInput, MatrixProvisioningResult } from './provisioning'
import { randomBytes } from 'node:crypto'
import { Effect } from 'effect'
import { fromPromise, runApiEffect } from '../../effect'

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

export function createConduitProvisioningAdapter(
  options: ConduitProvisioningAdapterOptions,
): MatrixProvisioningAdapter {
  const fetchImpl = options.fetch ?? fetch

  return {
    ensureUser(input): Promise<MatrixProvisioningResult> {
      return runApiEffect(ensureUserEffect(options.serverUrl, fetchImpl, input))
    },
  }
}

function ensureUserEffect(
  serverUrl: string,
  fetchImpl: typeof fetch,
  input: MatrixProvisioningInput,
): Effect.Effect<MatrixProvisioningResult, unknown, never> {
  return Effect.gen(function* () {
    const username = localpartFor(input)
    const password = randomPassword()
    const response = yield* fromPromise(() =>
      fetchImpl(`${serverUrl}/_matrix/client/v3/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          initial_device_display_name: 'Muon Desktop',
          auth: { type: 'm.login.dummy' },
        }),
      }),
    )
    const payload = (yield* fromPromise(() => response.json())) as {
      access_token?: string
      device_id?: string
      errcode?: string
      user_id?: string
    }

    if (!response.ok) {
      if (payload.errcode === 'M_USER_IN_USE') {
        return yield* Effect.fail(new Error('Matrix account already exists outside Muon provisioning'))
      }
      return yield* Effect.fail(new Error('Matrix provisioning failed'))
    }

    if (!payload.user_id || !payload.access_token || !payload.device_id)
      return yield* Effect.fail(new Error('Matrix provisioning returned an incomplete session'))

    return {
      matrixUserId: payload.user_id,
      accessToken: payload.access_token,
      deviceId: payload.device_id,
    }
  })
}

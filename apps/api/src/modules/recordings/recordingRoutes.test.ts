import type { EgressService } from './egressService'
import { describe, expect, it, vi } from 'vitest'
import { runApiEffect } from '../../effect'
import { createEnterpriseHttpEffectHandler } from '../../routes'

function fakeEgress(overrides: Partial<EgressService> = {}): EgressService {
  return {
    available: () => true,
    startRoomRecording: vi.fn().mockResolvedValue({ egressId: 'eg-1' }),
    stopRoomRecording: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function request(path: string, body: unknown, auth = true): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (auth) headers.Authorization = 'Bearer test-token'
  return new Request(`http://127.0.0.1:8787${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
}

async function send(handler: ReturnType<typeof createEnterpriseHttpEffectHandler>, req: Request) {
  const response = await runApiEffect(handler.fetch(req))
  return { status: response.status, body: (await response.json()) as Record<string, any> }
}

describe('cloud recording routes', () => {
  it('starts a room recording through the egress service', async () => {
    const egress = fakeEgress()
    const handler = createEnterpriseHttpEffectHandler({ egressService: egress })

    const result = await send(handler, request('/api/recordings/start', { roomName: 'call:abc' }))
    expect(result.status).toBe(201)
    expect(result.body.egressId).toBe('eg-1')
    expect(egress.startRoomRecording).toHaveBeenCalledWith('call:abc')
  })

  it('stops a recording through the egress service', async () => {
    const egress = fakeEgress()
    const handler = createEnterpriseHttpEffectHandler({ egressService: egress })

    const result = await send(handler, request('/api/recordings/stop', { egressId: 'eg-1' }))
    expect(result.status).toBe(200)
    expect(egress.stopRoomRecording).toHaveBeenCalledWith('eg-1')
  })

  it('returns 503 when recording is not configured', async () => {
    const handler = createEnterpriseHttpEffectHandler() // default: disabled egress service
    const result = await send(handler, request('/api/recordings/start', { roomName: 'call:abc' }))
    expect(result.status).toBe(503)
  })

  it('requires authentication', async () => {
    const handler = createEnterpriseHttpEffectHandler({ egressService: fakeEgress() })
    const result = await send(handler, request('/api/recordings/start', { roomName: 'call:abc' }, false))
    expect(result.status).toBe(401)
  })
})

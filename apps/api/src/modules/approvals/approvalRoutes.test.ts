import { describe, expect, it } from 'vitest'
import { runApiEffect } from '../../effect'
import { createEnterpriseHttpEffectHandler } from '../../routes'
import { createInMemoryApprovalStore } from './approvalService'

function handler() {
  return createEnterpriseHttpEffectHandler({ approvalStore: createInMemoryApprovalStore() })
}

function request(method: string, path: string, body?: unknown, auth = true): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (auth) headers.Authorization = 'Bearer test-token'
  return new Request(`http://127.0.0.1:8787${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function call(method: string, path: string, body?: unknown, auth = true) {
  const response = await runApiEffect(handler().fetch(request(method, path, body, auth)))
  return { status: response.status, body: (await response.json()) as Record<string, any> }
}

// 复用同一 handler 跨多次请求(共享服务端状态)
async function withHandler() {
  const h = handler()
  return async (method: string, path: string, body?: unknown) => {
    const response = await runApiEffect(h.fetch(request(method, path, body)))
    return { status: response.status, body: (await response.json()) as Record<string, any> }
  }
}

describe('approvals backend', () => {
  it('lists seeded approvals for an authenticated user', async () => {
    const { status, body } = await call('GET', '/api/approvals')
    expect(status).toBe(200)
    expect(Array.isArray(body.approvals)).toBe(true)
    expect((body.approvals as unknown[]).length).toBeGreaterThan(0)
  })

  it('rejects unauthenticated requests with 401', async () => {
    const { status } = await call('GET', '/api/approvals', undefined, false)
    expect(status).toBe(401)
  })

  it('advances one stage at a time then finalizes on the last approval', async () => {
    const send = await withHandler()
    // request-1 has two stages
    let result = await send('POST', '/api/approvals/request-1/decision', { decision: 'approved' })
    expect(result.body.approval.status).toBe('pending')
    expect(result.body.approval.currentStageIndex).toBe(1)

    result = await send('POST', '/api/approvals/request-1/decision', { decision: 'approved' })
    expect(result.body.approval.status).toBe('approved')
  })

  it('rejects a request immediately', async () => {
    const result = await call('POST', '/api/approvals/request-2/decision', { decision: 'rejected' })
    expect(result.body.approval.status).toBe('rejected')
  })

  it('transfers and records comments', async () => {
    const send = await withHandler()
    const transferred = await send('POST', '/api/approvals/request-1/transfer', { handler: '安全负责人' })
    expect(transferred.body.approval.handler).toBe('安全负责人')

    const commented = await send('POST', '/api/approvals/request-1/comment', { comment: '请补充材料' })
    expect(commented.body.approval.comments).toContain('请补充材料')
  })
})

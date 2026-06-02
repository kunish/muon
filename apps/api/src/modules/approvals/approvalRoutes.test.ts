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

  it('creates an approval and persists it for subsequent reads', async () => {
    const send = await withHandler()
    const created = await send('POST', '/api/approvals', {
      title: '设备采购',
      requester: '行政组',
      stages: ['主管审批', '财务确认'],
    })
    expect(created.status).toBe(200)
    expect(created.body.approval.id).toBeTruthy()
    expect(created.body.approval.status).toBe('pending')
    expect(created.body.approval.currentStageIndex).toBe(0)
    expect(created.body.approval.handler).toBe('主管审批')

    const list = await send('GET', '/api/approvals')
    const ids = (list.body.approvals as { id: string }[]).map((approval) => approval.id)
    expect(ids).toContain(created.body.approval.id)
  })

  it('rejects creating an approval with an empty title', async () => {
    const { status } = await call('POST', '/api/approvals', { title: '', requester: '行政组' })
    expect(status).toBeGreaterThanOrEqual(400)
  })

  it('lists built-in approval templates', async () => {
    const { status, body } = await call('GET', '/api/approvals/templates')
    expect(status).toBe(200)
    const ids = (body.templates as { id: string }[]).map((template) => template.id)
    expect(ids).toEqual(expect.arrayContaining(['leave', 'reimbursement', 'purchase', 'overtime']))
  })

  it('creates an approval from a template, inheriting its stages and storing form data', async () => {
    const send = await withHandler()
    const created = await send('POST', '/api/approvals', {
      title: '请假申请',
      requester: '张三',
      templateId: 'leave',
      formData: { leaveType: '年假', startDate: '2026-07-01', endDate: '2026-07-03', reason: '休息' },
    })
    expect(created.status).toBe(200)
    expect(created.body.approval.templateId).toBe('leave')
    expect(created.body.approval.stages).toEqual(['主管审批', '人事备案'])
    expect(created.body.approval.formData).toMatchObject({ leaveType: '年假' })
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

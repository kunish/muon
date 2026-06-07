import type { AuditLog } from '@muon/enterprise-contracts'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import AuditPage from '@/pages/AuditPage.vue'

const auditLogs = ref<AuditLog[]>([])
const queryError = ref<unknown>(null)

vi.mock('@/queries/useAuditLogs', () => ({
  useAuditLogs: () => ({ data: auditLogs, error: queryError }),
}))

function makeAuditLog(overrides: Partial<AuditLog>): AuditLog {
  return {
    id: 'log-1',
    organizationId: 'org-1',
    actorUserId: 'user-1',
    action: 'user.create',
    targetType: 'user',
    targetId: 'user-2',
    metadata: {},
    ipAddress: null,
    userAgent: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  } as AuditLog
}

describe('auditPage', () => {
  beforeEach(() => {
    auditLogs.value = []
    queryError.value = null
  })

  it('renders audit rows from useAuditLogs', () => {
    auditLogs.value = [
      makeAuditLog({ id: 'log-1', action: 'user.create' }),
      makeAuditLog({ id: 'log-2', action: 'user.reset_password' }),
    ]

    const wrapper = mount(AuditPage)

    const rows = wrapper.findAll('.audit-row')
    expect(rows).toHaveLength(2)
    expect(wrapper.text()).toContain('user.create')
    expect(wrapper.text()).toContain('user.reset_password')
    expect(wrapper.text()).toContain('2 / 2 条记录')
  })

  it('summarises metadata, falling back when empty', () => {
    auditLogs.value = [
      makeAuditLog({ id: 'log-1', metadata: { role: 'owner', tags: ['a', 'b'] } }),
      makeAuditLog({ id: 'log-2', metadata: {} }),
    ]

    const wrapper = mount(AuditPage)
    expect(wrapper.text()).toContain('role: owner')
    expect(wrapper.text()).toContain('tags: a, b')
    expect(wrapper.text()).toContain('无附加信息')
  })

  it('renders the no-target fallback when targetId is null', () => {
    auditLogs.value = [makeAuditLog({ id: 'log-1', targetId: null })]
    const wrapper = mount(AuditPage)
    expect(wrapper.text()).toContain('无目标')
  })

  it('filters audit logs by the search query', async () => {
    auditLogs.value = [
      makeAuditLog({ id: 'log-1', action: 'user.create', targetType: 'user' }),
      makeAuditLog({ id: 'log-2', action: 'org.install', targetType: 'organization' }),
    ]

    const wrapper = mount(AuditPage)
    expect(wrapper.findAll('.audit-row')).toHaveLength(2)

    await wrapper.find('[data-testid="audit-search"]').setValue('install')

    const rows = wrapper.findAll('.audit-row')
    expect(rows).toHaveLength(1)
    expect(wrapper.text()).toContain('org.install')
    expect(wrapper.text()).not.toContain('user.create')
    expect(wrapper.text()).toContain('1 / 2 条记录')
  })

  it('filters by metadata content', async () => {
    auditLogs.value = [
      makeAuditLog({ id: 'log-1', action: 'a', metadata: { needle: 'findme' } }),
      makeAuditLog({ id: 'log-2', action: 'b', metadata: {} }),
    ]

    const wrapper = mount(AuditPage)
    await wrapper.find('[data-testid="audit-search"]').setValue('findme')

    expect(wrapper.findAll('.audit-row')).toHaveLength(1)
  })

  it('shows the empty state when no logs match', async () => {
    auditLogs.value = [makeAuditLog({ id: 'log-1', action: 'user.create' })]

    const wrapper = mount(AuditPage)
    await wrapper.find('[data-testid="audit-search"]').setValue('nonexistent')

    expect(wrapper.findAll('.audit-row')).toHaveLength(0)
    expect(wrapper.text()).toContain('没有匹配的审计日志')
  })

  it('surfaces the query error message', () => {
    queryError.value = new Error('加载审计日志失败')
    const wrapper = mount(AuditPage)
    expect(wrapper.find('[data-testid="audit-error"]').text()).toBe('加载审计日志失败')
  })
})

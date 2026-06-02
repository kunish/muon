import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ApprovalsPage from '@/features/approvals/components/ApprovalsPage.vue'

const api = vi.hoisted(() => ({
  isApprovalsBackendConfigured: vi.fn(() => true),
  fetchApprovals: vi.fn(),
  fetchApprovalTemplates: vi.fn(),
  createApproval: vi.fn(),
  decideApproval: vi.fn(),
  transferApproval: vi.fn(),
  commentApproval: vi.fn(),
}))

vi.mock('@/features/approvals/lib/approvalsApi', () => api)

function backendSeed() {
  return [
    {
      id: 'b1',
      title: '采购审批',
      requester: '采购组',
      stages: ['一级审批', '二级审批'],
      currentStageIndex: 0,
      status: 'pending' as const,
      handler: '一级审批',
      comments: [],
    },
  ]
}

describe('approvals page backend mode', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    api.isApprovalsBackendConfigured.mockReturnValue(true)
    api.fetchApprovals.mockResolvedValue(backendSeed())
  })

  it('loads approvals from the app backend on mount', async () => {
    const wrapper = mount(ApprovalsPage)
    await flushPromises()

    expect(api.fetchApprovals).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="approvals-request-b1"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('采购审批')
  })

  it('routes the approve decision through the backend and reflects the response', async () => {
    api.decideApproval.mockResolvedValue({
      ...backendSeed()[0],
      currentStageIndex: 1,
      status: 'pending',
      handler: '二级审批',
    })

    const wrapper = mount(ApprovalsPage)
    await flushPromises()

    await wrapper.get('[data-testid="approvals-request-b1"]').trigger('click')
    await wrapper.get('[data-testid="approvals-approve-selected"]').trigger('click')
    await flushPromises()

    expect(api.decideApproval).toHaveBeenCalledWith('b1', 'approved')
    expect(wrapper.text()).toContain('二级审批')
  })
})

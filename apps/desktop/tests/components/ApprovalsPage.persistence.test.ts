import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import ApprovalsPage from '@/features/approvals/components/ApprovalsPage.vue'

describe('approvals persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('keeps an approval decision across remounts', async () => {
    const first = mount(ApprovalsPage)
    // request-2 is the default selection in the pending queue
    await first.get('[data-testid="approvals-approve-selected"]').trigger('click')

    const stored = JSON.parse(localStorage.getItem('muon_approval_overrides') || '{}')
    expect(stored['request-2']).toMatchObject({ decision: 'approved' })

    const second = mount(ApprovalsPage)
    // pending queue no longer holds the approved request
    expect(second.find('[data-testid="approvals-request-request-2"]').exists()).toBe(false)

    await second.get('[data-testid="approvals-queue-approved"]').trigger('click')
    expect(second.find('[data-testid="approvals-request-request-2"]').exists()).toBe(true)
  })

  it('persists an added comment for a request', async () => {
    const first = mount(ApprovalsPage)
    await first.get('[data-testid="approvals-comment-input"]').setValue('请补充合规材料')
    await first.get('[data-testid="approvals-add-comment"]').trigger('click')

    const stored = JSON.parse(localStorage.getItem('muon_approval_overrides') || '{}')
    expect(stored['request-2'].comments).toContain('请补充合规材料')
  })
})

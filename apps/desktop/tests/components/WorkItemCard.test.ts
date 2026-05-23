import type { WorkItem } from '@/features/projects/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WorkItemCard from '@/features/projects/components/WorkItemCard.vue'

function overdueItem(status = 'custom_done'): WorkItem {
  return {
    id: 'item-1',
    projectId: 'project-1',
    type: 'task',
    title: '完成发布复盘',
    description: '',
    status,
    priority: 'none',
    dueDate: Date.now() - 86_400_000,
    order: 0,
    customFields: {},
    linkedDecisions: [],
    createdAt: Date.now() - 172_800_000,
    updatedAt: Date.now() - 86_400_000,
  }
}

describe('workItemCard', () => {
  it('does not mark overdue tasks as late when their workflow category is done', () => {
    const wrapper = mount(WorkItemCard, {
      props: {
        item: overdueItem(),
        statusCategory: 'done',
      },
    })

    expect(wrapper.find('.text-destructive').exists()).toBe(false)
  })

  it('marks overdue tasks as late when their workflow category is not done', () => {
    const wrapper = mount(WorkItemCard, {
      props: {
        item: overdueItem('in_review'),
        statusCategory: 'in_progress',
      },
    })

    expect(wrapper.find('.text-destructive').exists()).toBe(true)
  })
})

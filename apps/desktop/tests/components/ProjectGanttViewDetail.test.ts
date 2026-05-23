import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import GanttView from '@/features/projects/components/view/GanttView.vue'

const itemStoreMock = vi.hoisted(() => ({
  currentItems: [] as any[],
}))

vi.mock('@/features/projects/composables/useWorkItemStore', () => ({
  useWorkItemStore: () => itemStoreMock,
}))

const WorkItemDetailStub = defineComponent({
  name: 'WorkItemDetail',
  props: {
    itemId: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    return () =>
      h('div', {
        'data-testid': 'project-gantt-work-item-detail',
        'data-item-id': props.itemId,
      })
  },
})

function mountGanttView() {
  return mount(GanttView, {
    props: {
      projectId: 'project-1',
    },
    global: {
      stubs: {
        WorkItemDetail: WorkItemDetailStub,
      },
    },
  })
}

describe('projectGanttViewDetail', () => {
  beforeEach(() => {
    itemStoreMock.currentItems = [
      {
        id: 'item-1',
        title: '发版里程碑',
        dueDate: Date.now() + 86_400_000,
      },
    ]
  })

  it('opens the task detail drawer from a gantt row', async () => {
    const wrapper = mountGanttView()

    await wrapper.get('[data-testid="project-gantt-row-item-1"]').trigger('click')

    expect(wrapper.get('[data-testid="project-gantt-work-item-detail"]').attributes('data-item-id')).toBe('item-1')
  })
})

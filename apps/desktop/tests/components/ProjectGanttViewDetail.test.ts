import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import GanttView from '@/features/projects/components/view/GanttView.vue'
import { resetWorkItemStore, setCurrentProject, setWorkItems } from '@/features/projects/composables/useWorkItemStore'

vi.mock('@/features/projects/composables/useWorkItemStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/projects/composables/useWorkItemStore')>()),
}))

function seedCurrentItems(projectId: string, items: any[]) {
  setCurrentProject(projectId)
  setWorkItems(projectId, items)
}

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
    resetWorkItemStore()
    seedCurrentItems('project-1', [
      {
        id: 'item-1',
        title: '发版里程碑',
        dueDate: Date.now() + 86_400_000,
      },
    ])
  })

  it('opens the task detail drawer from a gantt row', async () => {
    const wrapper = mountGanttView()

    await wrapper.get('[data-testid="project-gantt-row-item-1"]').trigger('click')

    expect(wrapper.get('[data-testid="project-gantt-work-item-detail"]').attributes('data-item-id')).toBe('item-1')
  })
})

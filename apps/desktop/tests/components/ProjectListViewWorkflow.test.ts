import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import ListView from '@/features/projects/components/view/ListView.vue'
import { resetWorkItemStore, setCurrentProject, setWorkItems } from '@/features/projects/composables/useWorkItemStore'

const workflowMock = vi.hoisted(() => ({
  loadWorkflow: vi.fn(),
}))

vi.mock('@/features/projects/composables/useWorkflow', () => ({
  useWorkflow: () => workflowMock,
}))

vi.mock('@/features/projects/composables/useWorkItemStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/projects/composables/useWorkItemStore')>()),
}))

function seedCurrentItems(projectId: string, items: any[]) {
  setCurrentProject(projectId)
  setWorkItems(projectId, items)
}

const ButtonStub = defineComponent({
  name: 'Button',
  setup(_, { attrs, slots }) {
    return () => h('button', attrs, slots.default?.())
  },
})

const CreateDialogStub = defineComponent({
  name: 'WorkItemCreateDialog',
  props: {
    defaultStatus: {
      type: String,
      required: true,
    },
    open: Boolean,
    projectId: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    return () =>
      h('div', {
        'data-testid': 'project-list-create-dialog',
        'data-default-status': props.defaultStatus,
        'data-project-id': props.projectId,
        'data-open': String(props.open),
      })
  },
})

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
        'data-testid': 'project-list-work-item-detail',
        'data-item-id': props.itemId,
      })
  },
})

function mountListView() {
  return mount(ListView, {
    props: {
      projectId: 'project-1',
    },
    global: {
      stubs: {
        Button: ButtonStub,
        WorkItemCreateDialog: CreateDialogStub,
        WorkItemDetail: WorkItemDetailStub,
      },
    },
  })
}

describe('projectListViewWorkflow', () => {
  beforeEach(() => {
    resetWorkItemStore()
    workflowMock.loadWorkflow.mockReset()
    workflowMock.loadWorkflow.mockResolvedValue({
      statuses: [
        { key: 'backlog', name: '需求池', color: '#e5e7eb', category: 'todo' },
        { key: 'shipping', name: '发布中', color: '#3b82f6', category: 'in_progress' },
      ],
      transitions: [],
    })
    seedCurrentItems('project-1', [
      {
        id: 'item-1',
        title: '验收发版计划',
        status: 'backlog',
        priority: 'none',
        createdAt: 1,
      },
    ])
  })

  it('uses workflow status names and creates list tasks in the first workflow status', async () => {
    const wrapper = mountListView()

    await flushPromises()

    expect(wrapper.text()).toContain('需求池')
    expect(wrapper.text()).not.toContain('backlog')
    expect(wrapper.get('[data-testid="project-list-create-dialog"]').attributes('data-default-status')).toBe('backlog')

    await wrapper.get('[data-testid="project-list-create-task"]').trigger('click')

    expect(wrapper.get('[data-testid="project-list-create-dialog"]').attributes('data-open')).toBe('true')
  })

  it('opens the task detail drawer from a list row', async () => {
    const wrapper = mountListView()

    await flushPromises()
    await wrapper.get('[data-testid="project-list-row-item-1"]').trigger('click')

    expect(wrapper.get('[data-testid="project-list-work-item-detail"]').attributes('data-item-id')).toBe('item-1')
  })
})

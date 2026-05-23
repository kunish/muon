import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import BoardView from '@/features/projects/components/view/BoardView.vue'

const workflowMock = vi.hoisted(() => ({
  canTransition: vi.fn(),
  loadWorkflow: vi.fn(),
}))

const itemStoreMock = vi.hoisted(() => ({
  currentItems: [] as any[],
  reorderItem: vi.fn(),
}))

vi.mock('@/features/projects/composables/useWorkflow', () => ({
  useWorkflow: () => workflowMock,
}))

vi.mock('@/features/projects/composables/useWorkItemStore', () => ({
  useWorkItemStore: () => itemStoreMock,
}))

const ButtonStub = defineComponent({
  name: 'Button',
  setup(_, { attrs, slots }) {
    return () => h('button', attrs, slots.default?.())
  },
})

const WorkItemCardStub = defineComponent({
  name: 'WorkItemCard',
  props: {
    item: {
      type: Object,
      required: true,
    },
  },
  setup(props, { attrs }) {
    return () =>
      h(
        'div',
        {
          ...attrs,
          'data-testid': `project-card-${(props.item as any).id}`,
        },
        (props.item as any).title,
      )
  },
})

function workflowFixture() {
  return {
    id: 'workflow-1',
    projectId: 'project-1',
    statuses: [
      { key: 'todo', name: '待办', color: '#e5e7eb', category: 'todo' },
      { key: 'done', name: '完成', color: '#22c55e', category: 'done' },
    ],
    transitions: [{ from: 'todo', to: 'done', name: '完成' }],
  }
}

function mountBoard() {
  return mount(BoardView, {
    props: {
      projectId: 'project-1',
    },
    global: {
      stubs: {
        Button: ButtonStub,
        WorkItemCard: WorkItemCardStub,
        WorkItemCreateDialog: true,
        WorkItemDetail: true,
      },
    },
  })
}

async function dropItem(wrapper: ReturnType<typeof mount>, targetStatus: string, itemId: string) {
  await wrapper.get(`[data-testid="project-board-column-${targetStatus}"]`).trigger('drop', {
    dataTransfer: {
      getData: vi.fn(() => itemId),
    },
    preventDefault: vi.fn(),
  })
}

describe('projectBoardWorkflow', () => {
  beforeEach(() => {
    workflowMock.canTransition.mockReset()
    workflowMock.loadWorkflow.mockReset()
    workflowMock.loadWorkflow.mockResolvedValue(workflowFixture())
    itemStoreMock.reorderItem.mockReset()
    itemStoreMock.reorderItem.mockResolvedValue(undefined)
    itemStoreMock.currentItems = [
      {
        id: 'item-1',
        projectId: 'project-1',
        title: '待办任务',
        status: 'todo',
        order: 0,
      },
      {
        id: 'item-2',
        projectId: 'project-1',
        title: '已完成任务',
        status: 'done',
        order: 2,
      },
    ]
  })

  it('does not move cards through a disallowed workflow transition', async () => {
    workflowMock.canTransition.mockReturnValue(false)
    const wrapper = mountBoard()
    await flushPromises()

    await dropItem(wrapper, 'done', 'item-1')

    expect(workflowMock.canTransition).toHaveBeenCalledWith(expect.any(Object), 'todo', 'done')
    expect(itemStoreMock.reorderItem).not.toHaveBeenCalled()
  })

  it('moves cards when the workflow transition is allowed', async () => {
    workflowMock.canTransition.mockReturnValue(true)
    const wrapper = mountBoard()
    await flushPromises()

    await dropItem(wrapper, 'done', 'item-1')

    expect(itemStoreMock.reorderItem).toHaveBeenCalledWith('item-1', 'project-1', 3, 'done')
  })
})

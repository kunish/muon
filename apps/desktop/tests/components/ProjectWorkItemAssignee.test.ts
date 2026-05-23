import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import WorkItemCreateDialog from '@/features/projects/components/WorkItemCreateDialog.vue'
import WorkItemDetail from '@/features/projects/components/WorkItemDetail.vue'

const storeMock = vi.hoisted(() => ({
  currentItems: [] as any[],
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}))

const workflowMock = vi.hoisted(() => ({
  loadWorkflow: vi.fn(),
  getAvailableTransitions: vi.fn(),
  changeStatus: vi.fn(),
}))

const projectRepoMock = vi.hoisted(() => ({
  listCustomFields: vi.fn(),
}))

vi.mock('@/features/projects/composables/useWorkItemStore', () => ({
  useWorkItemStore: () => storeMock,
}))

vi.mock('@/features/projects/composables/useWorkflow', () => ({
  useWorkflow: () => workflowMock,
}))

vi.mock('@/features/projects/db/projectDb', () => ({
  projectRepo: projectRepoMock,
}))

function renderSlots(name: string) {
  return defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.())
    },
  })
}

const ButtonStub = defineComponent({
  name: 'Button',
  props: {
    disabled: Boolean,
    loading: Boolean,
  },
  setup(props, { attrs, slots }) {
    return () => h('button', { ...attrs, disabled: props.disabled }, slots.default?.())
  },
})

const InputStub = defineComponent({
  name: 'Input',
  props: {
    modelValue: {
      type: [String, Number],
      default: '',
    },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    return () =>
      h('input', {
        ...attrs,
        value: props.modelValue,
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
      })
  },
})

const TextareaStub = defineComponent({
  name: 'Textarea',
  props: {
    modelValue: {
      type: [String, Number],
      default: '',
    },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    return () =>
      h('textarea', {
        ...attrs,
        value: props.modelValue,
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLTextAreaElement).value),
      })
  },
})

const AssigneePickerStub = defineComponent({
  name: 'WorkItemAssigneePicker',
  props: {
    modelValue: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    return () =>
      h(
        'button',
        {
          ...attrs,
          type: 'button',
          onClick: () => emit('update:modelValue', '@alice:localhost'),
        },
        props.modelValue || '选择负责人',
      )
  },
})

const projectStubs = {
  Button: ButtonStub,
  Dialog: renderSlots('Dialog'),
  DialogContent: renderSlots('DialogContent'),
  DialogFooter: renderSlots('DialogFooter'),
  DialogHeader: renderSlots('DialogHeader'),
  DialogTitle: renderSlots('DialogTitle'),
  Input: InputStub,
  Label: renderSlots('Label'),
  Select: renderSlots('Select'),
  SelectContent: renderSlots('SelectContent'),
  SelectItem: renderSlots('SelectItem'),
  SelectTrigger: renderSlots('SelectTrigger'),
  SelectValue: renderSlots('SelectValue'),
  Textarea: TextareaStub,
  WorkItemAssigneePicker: AssigneePickerStub,
}

describe('project work item assignee editing', () => {
  beforeEach(() => {
    storeMock.currentItems = [
      {
        id: 'item-1',
        projectId: 'project-1',
        type: 'task',
        title: '跟进上线检查',
        description: '确认客户端发版准备',
        status: 'todo',
        priority: 'medium',
        assignee: '@bob:localhost',
        customFields: {},
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]
    storeMock.createItem.mockReset()
    storeMock.createItem.mockResolvedValue({})
    storeMock.updateItem.mockReset()
    storeMock.updateItem.mockResolvedValue(storeMock.currentItems[0])
    storeMock.deleteItem.mockReset()
    workflowMock.loadWorkflow.mockReset()
    workflowMock.loadWorkflow.mockResolvedValue({ statuses: [], transitions: [] })
    workflowMock.getAvailableTransitions.mockReset()
    workflowMock.getAvailableTransitions.mockReturnValue([])
    workflowMock.changeStatus.mockReset()
    projectRepoMock.listCustomFields.mockReset()
    projectRepoMock.listCustomFields.mockResolvedValue([])
  })

  it('labels priority separately and updates the selected assignee in the task detail drawer', async () => {
    const wrapper = mount(WorkItemDetail, {
      props: {
        itemId: 'item-1',
      },
      global: {
        stubs: projectStubs,
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('优先级')
    expect(wrapper.text()).toContain('负责人')
    expect(wrapper.text()).toContain('类型')
    expect(wrapper.text()).not.toContain('assignee')

    await wrapper.get('[data-testid="project-task-assignee-picker"]').trigger('click')
    await flushPromises()

    expect(storeMock.updateItem).toHaveBeenCalledWith('item-1', { assignee: '@alice:localhost' })
  })

  it('updates configured custom field values in the task detail drawer', async () => {
    storeMock.currentItems[0].customFields = {
      cf_score: 3,
    }
    projectRepoMock.listCustomFields.mockResolvedValue([
      {
        id: 'cf_score',
        projectId: 'project-1',
        name: '验收分',
        type: 'number',
        options: [],
        required: false,
        order: 0,
      },
    ])

    const wrapper = mount(WorkItemDetail, {
      props: {
        itemId: 'item-1',
      },
      global: {
        stubs: projectStubs,
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('自定义字段')
    expect(wrapper.text()).toContain('验收分')
    expect((wrapper.get('[data-testid="project-task-custom-field-cf_score"]').element as HTMLInputElement).value).toBe(
      '3',
    )

    await wrapper.get('[data-testid="project-task-custom-field-cf_score"]').setValue('8')
    await flushPromises()

    expect(storeMock.updateItem).toHaveBeenCalledWith('item-1', { customFields: { cf_score: 8 } })
  })

  it('updates select and multi-select custom field values from configured options', async () => {
    storeMock.currentItems[0].customFields = {
      cf_stage: '待确认',
      cf_tags: ['移动端'],
    }
    projectRepoMock.listCustomFields.mockResolvedValue([
      {
        id: 'cf_stage',
        projectId: 'project-1',
        name: '验收阶段',
        type: 'select',
        options: ['待确认', '通过'],
        required: false,
        order: 0,
      },
      {
        id: 'cf_tags',
        projectId: 'project-1',
        name: '验收范围',
        type: 'multiSelect',
        options: ['移动端', '桌面端'],
        required: false,
        order: 1,
      },
    ])

    const wrapper = mount(WorkItemDetail, {
      props: {
        itemId: 'item-1',
      },
      global: {
        stubs: projectStubs,
      },
    })

    await flushPromises()

    expect((wrapper.get('[data-testid="project-task-custom-field-cf_stage"]').element as HTMLSelectElement).value).toBe(
      '待确认',
    )

    await wrapper.get('[data-testid="project-task-custom-field-cf_stage"]').setValue('通过')
    await flushPromises()

    expect(storeMock.updateItem).toHaveBeenCalledWith('item-1', {
      customFields: { cf_stage: '通过', cf_tags: ['移动端'] },
    })

    await wrapper.get('[data-testid="project-task-custom-field-cf_tags-option-1"]').setValue(true)
    await flushPromises()

    expect(storeMock.updateItem).toHaveBeenCalledWith('item-1', {
      customFields: { cf_stage: '待确认', cf_tags: ['移动端', '桌面端'] },
    })
  })

  it('shows readable workflow transition actions in the task detail drawer', async () => {
    workflowMock.loadWorkflow.mockResolvedValue({
      statuses: [
        { key: 'todo', name: '待办', color: '#e5e7eb', category: 'todo' },
        { key: 'done', name: '已完成', color: '#22c55e', category: 'done' },
      ],
      transitions: [{ from: 'todo', to: 'done', name: '完成验收' }],
    })

    const wrapper = mount(WorkItemDetail, {
      props: {
        itemId: 'item-1',
      },
      global: {
        stubs: projectStubs,
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('完成验收')

    await wrapper.get('[data-testid="project-task-transition-done"]').trigger('click')
    await flushPromises()

    expect(workflowMock.changeStatus).toHaveBeenCalledWith('item-1', 'done')
  })

  it('creates a task with selected core fields', async () => {
    const wrapper = mount(WorkItemCreateDialog, {
      props: {
        open: true,
        projectId: 'project-1',
        defaultStatus: 'todo',
      },
      global: {
        stubs: projectStubs,
      },
    })

    await wrapper.get('[data-testid="project-task-title-input"]').setValue('补齐验收清单')
    await wrapper.get('[data-testid="project-task-assignee-picker"]').trigger('click')
    await wrapper.get('[data-testid="project-task-due-date-input"]').setValue('2026-05-20')

    const selects = wrapper.findAllComponents({ name: 'Select' })
    await selects[0].vm.$emit('update:modelValue', 'bug')
    await selects[1].vm.$emit('update:modelValue', 'high')

    await wrapper
      .findAll('button')
      .find((button) => button.text() === '确定')!
      .trigger('click')
    await flushPromises()

    expect(storeMock.createItem).toHaveBeenCalledWith('project-1', {
      title: '补齐验收清单',
      description: '',
      assignee: '@alice:localhost',
      priority: 'high',
      type: 'bug',
      dueDate: new Date('2026-05-20').getTime(),
      status: 'todo',
    })
  })
})

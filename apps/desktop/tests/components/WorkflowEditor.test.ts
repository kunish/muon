import type { Workflow } from '@/features/projects/types'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import WorkflowEditor from '@/features/projects/components/settings/WorkflowEditor.vue'

const workflowMock = vi.hoisted(() => ({
  loadWorkflow: vi.fn(),
  saveWorkflow: vi.fn(),
}))

vi.mock('@/features/projects/composables/useWorkflow', () => ({
  useWorkflow: () => workflowMock,
}))

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

function workflowFixture(): Workflow {
  return {
    id: 'workflow-1',
    projectId: 'project-1',
    statuses: [
      { key: 'todo', name: '待办', color: '#e5e7eb', category: 'todo' },
      { key: 'done', name: '已完成', color: '#22c55e', category: 'done' },
    ],
    transitions: [{ from: 'todo', to: 'done', name: '完成' }],
  }
}

function mountEditor() {
  return mount(WorkflowEditor, {
    props: {
      projectId: 'project-1',
    },
    global: {
      stubs: {
        Button: ButtonStub,
        Input: InputStub,
      },
    },
  })
}

describe('workflowEditor', () => {
  beforeEach(() => {
    workflowMock.loadWorkflow.mockReset()
    workflowMock.saveWorkflow.mockReset()
    workflowMock.saveWorkflow.mockResolvedValue({})
  })

  it('adds a localized status with an editable category', async () => {
    workflowMock.loadWorkflow.mockResolvedValue(workflowFixture())

    const wrapper = mountEditor()
    await flushPromises()

    await wrapper.get('[data-testid="project-workflow-add-status"]').trigger('click')

    expect(wrapper.text()).toContain('新状态')
    expect(wrapper.findAll('[data-testid="project-workflow-status-category"]')).toHaveLength(3)
    expect(wrapper.text()).toContain('处理中')
  })

  it('updates transitions when a status key changes before saving', async () => {
    const workflow = workflowFixture()
    workflowMock.loadWorkflow.mockResolvedValue(workflow)

    const wrapper = mountEditor()
    await flushPromises()

    await wrapper.findAll('[data-testid="project-workflow-status-key"]')[0].setValue('backlog')
    await wrapper.get('[data-testid="project-workflow-save"]').trigger('click')
    await flushPromises()

    expect(workflowMock.saveWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: [expect.objectContaining({ key: 'backlog' }), expect.objectContaining({ key: 'done' })],
        transitions: [expect.objectContaining({ from: 'backlog', to: 'done' })],
      }),
    )
  })

  it('removes transitions that reference a deleted status', async () => {
    const workflow = workflowFixture()
    workflowMock.loadWorkflow.mockResolvedValue(workflow)

    const wrapper = mountEditor()
    await flushPromises()

    await wrapper.findAll('[data-testid="project-workflow-remove-status"]')[0].trigger('click')
    await wrapper.get('[data-testid="project-workflow-save"]').trigger('click')
    await flushPromises()

    expect(workflowMock.saveWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: [expect.objectContaining({ key: 'done' })],
        transitions: [],
      }),
    )
  })
})

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import ProjectSettings from '@/features/projects/components/ProjectSettings.vue'

const routerPush = vi.fn()

const projectsSeed = vi.hoisted(() => ({ projects: [] as any[] }))
const updateMutateAsync = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}))

vi.mock('@/features/projects/queries/useProjects', () => ({
  useProjectsQuery: () => ({
    projects: {
      get value() {
        return projectsSeed.projects
      },
    },
    isLoading: { value: false },
    refetch: vi.fn().mockResolvedValue(undefined),
  }),
  useUpdateProject: () => ({ mutateAsync: updateMutateAsync }),
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

function mountSettings() {
  return mount(ProjectSettings, {
    props: {
      projectId: '!project:localhost',
    },
    global: {
      stubs: {
        Button: ButtonStub,
        CustomFieldEditor: true,
        Input: InputStub,
        Label: true,
        Textarea: TextareaStub,
        WorkflowEditor: true,
      },
    },
  })
}

describe('projectSettings', () => {
  beforeEach(() => {
    routerPush.mockReset()
    updateMutateAsync.mockReset()
    updateMutateAsync.mockResolvedValue({})
    projectsSeed.projects = [
      {
        id: '!project:localhost',
        name: '旧项目',
        description: '旧描述',
        template: 'kanban',
        visibility: 'team',
        createdBy: '@me:localhost',
        createdAt: 1,
        updatedAt: 1,
      },
    ]
  })

  it('saves general project name and description changes', async () => {
    const wrapper = mountSettings()
    await flushPromises()

    expect((wrapper.get('[data-testid="project-settings-name-input"]').element as HTMLInputElement).value).toBe(
      '旧项目',
    )
    expect(wrapper.get('[data-testid="project-settings-save-general"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-testid="project-settings-name-input"]').setValue('新项目')
    await wrapper.get('[data-testid="project-settings-description-input"]').setValue('新的项目描述')
    await wrapper.get('[data-testid="project-settings-save-general"]').trigger('click')
    await flushPromises()

    expect(updateMutateAsync).toHaveBeenCalledWith({
      id: '!project:localhost',
      changes: {
        name: '新项目',
        description: '新的项目描述',
      },
    })
  })
})

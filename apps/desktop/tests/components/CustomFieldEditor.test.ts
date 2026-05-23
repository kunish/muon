import type { CustomField } from '@/features/projects/types'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import CustomFieldEditor from '@/features/projects/components/settings/CustomFieldEditor.vue'

const projectRepoMock = vi.hoisted(() => ({
  deleteCustomField: vi.fn(),
  listCustomFields: vi.fn(),
  saveCustomField: vi.fn(),
}))

vi.mock('@/features/projects/db/projectDb', () => ({
  projectRepo: projectRepoMock,
}))

const ButtonStub = defineComponent({
  name: 'Button',
  setup(_, { attrs, slots }) {
    return () => h('button', attrs, slots.default?.())
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
    return () => h('input', {
      ...attrs,
      value: props.modelValue,
      onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
    })
  },
})

function mountEditor() {
  return mount(CustomFieldEditor, {
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

function customField(overrides: Partial<CustomField> = {}): CustomField {
  return {
    id: 'field-1',
    projectId: 'project-1',
    name: '优先级标签',
    type: 'select',
    options: ['待确认', '通过'],
    required: false,
    order: 0,
    ...overrides,
  }
}

describe('customFieldEditor', () => {
  beforeEach(() => {
    projectRepoMock.deleteCustomField.mockReset()
    projectRepoMock.listCustomFields.mockReset()
    projectRepoMock.saveCustomField.mockReset()
    projectRepoMock.saveCustomField.mockResolvedValue(undefined)
  })

  it('shows a custom-field empty state instead of the task empty copy', async () => {
    projectRepoMock.listCustomFields.mockResolvedValue([])

    const wrapper = mountEditor()
    await flushPromises()

    expect(wrapper.text()).toContain('暂无自定义字段')
    expect(wrapper.text()).not.toContain('此分栏暂无任务')
  })

  it('localizes field types and saves select options', async () => {
    const field = customField()
    projectRepoMock.listCustomFields.mockResolvedValue([field])

    const wrapper = mountEditor()
    await flushPromises()

    expect(wrapper.get('[data-testid="project-custom-field-type"]').text()).toContain('单选')
    expect((wrapper.get('[data-testid="project-custom-field-options"]').element as HTMLInputElement).value).toBe('待确认, 通过')

    await wrapper.get('[data-testid="project-custom-field-options"]').setValue('待确认, 通过, 驳回')

    expect(projectRepoMock.saveCustomField).toHaveBeenCalledWith(expect.objectContaining({
      id: 'field-1',
      options: ['待确认', '通过', '驳回'],
    }))
  })

  it('clears stale options when an option field changes to a plain field', async () => {
    const field = customField({
      options: ['A', 'B'],
    })
    projectRepoMock.listCustomFields.mockResolvedValue([field])

    const wrapper = mountEditor()
    await flushPromises()

    await wrapper.get('[data-testid="project-custom-field-type"]').setValue('text')

    expect(projectRepoMock.saveCustomField).toHaveBeenCalledWith(expect.objectContaining({
      id: 'field-1',
      type: 'text',
      options: [],
    }))
  })
})

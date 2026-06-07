import type { Department } from '@muon/enterprise-contracts'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import DepartmentsPage from '@/pages/DepartmentsPage.vue'

const departments = ref<Department[]>([])
const isLoading = ref(false)
const queryError = ref<unknown>(null)

const createMutateAsync = vi.fn()
const createIsPending = ref(false)
const createError = ref<unknown>(null)

const reparentMutateAsync = vi.fn()
const reparentError = ref<unknown>(null)

const deleteMutateAsync = vi.fn()
const deleteError = ref<unknown>(null)

vi.mock('@/queries/useDepartments', () => ({
  useDepartments: () => ({ data: departments, isLoading, error: queryError }),
  useCreateDepartment: () => ({ mutateAsync: createMutateAsync, isPending: createIsPending, error: createError }),
  useReparentDepartment: () => ({ mutateAsync: reparentMutateAsync, error: reparentError }),
  useDeleteDepartment: () => ({ mutateAsync: deleteMutateAsync, error: deleteError }),
}))

function makeDepartment(overrides: Partial<Department>): Department {
  return {
    id: 'dep-1',
    organizationId: 'org-1',
    name: '部门一',
    parentId: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  } as Department
}

describe('departmentsPage', () => {
  beforeEach(() => {
    departments.value = []
    isLoading.value = false
    queryError.value = null
    createIsPending.value = false
    createError.value = null
    reparentError.value = null
    deleteError.value = null
    createMutateAsync.mockReset()
    createMutateAsync.mockResolvedValue(undefined)
    reparentMutateAsync.mockReset()
    reparentMutateAsync.mockResolvedValue(undefined)
    deleteMutateAsync.mockReset()
    deleteMutateAsync.mockResolvedValue(undefined)
  })

  it('renders department rows from useDepartments', () => {
    departments.value = [
      makeDepartment({ id: 'dep-1', name: '研发部' }),
      makeDepartment({ id: 'dep-2', name: '市场部', parentId: 'dep-1' }),
    ]

    const wrapper = mount(DepartmentsPage)

    const rows = wrapper.findAll('.department-row')
    expect(rows).toHaveLength(2)
    expect(wrapper.text()).toContain('研发部')
    expect(wrapper.text()).toContain('市场部')
    // 子部门的当前上级解析为父部门名称
    expect(wrapper.text()).toContain('当前上级：研发部')
  })

  it('shows the empty state when there are no departments', () => {
    const wrapper = mount(DepartmentsPage)
    expect(wrapper.text()).toContain('暂无部门，先创建一个吧')
  })

  it('submits a create with the trimmed name and resolved parent', async () => {
    departments.value = [makeDepartment({ id: 'dep-1', name: '研发部' })]

    const wrapper = mount(DepartmentsPage)

    await wrapper.find('[data-testid="department-name"]').setValue('  市场部  ')
    await wrapper.find('[data-testid="department-parent"]').setValue('dep-1')
    await wrapper.find('form[data-testid="department-form"]').trigger('submit')
    await flushPromises()

    expect(createMutateAsync).toHaveBeenCalledTimes(1)
    expect(createMutateAsync).toHaveBeenCalledWith({ name: '市场部', parentId: 'dep-1' })
  })

  it('does not submit when the name is blank', async () => {
    const wrapper = mount(DepartmentsPage)

    await wrapper.find('form[data-testid="department-form"]').trigger('submit')
    await flushPromises()

    expect(createMutateAsync).not.toHaveBeenCalled()
  })

  it('reparents a department through the row select', async () => {
    departments.value = [
      makeDepartment({ id: 'dep-1', name: '研发部' }),
      makeDepartment({ id: 'dep-2', name: '市场部' }),
    ]

    const wrapper = mount(DepartmentsPage)

    await wrapper.find('[data-testid="department-parent-dep-2"]').setValue('dep-1')
    await flushPromises()

    expect(reparentMutateAsync).toHaveBeenCalledWith({ departmentId: 'dep-2', parentId: 'dep-1' })
  })

  it('deletes a department through the row button', async () => {
    departments.value = [makeDepartment({ id: 'dep-1', name: '研发部' })]

    const wrapper = mount(DepartmentsPage)

    await wrapper.find('[data-testid="department-delete-dep-1"]').trigger('click')
    await flushPromises()

    expect(deleteMutateAsync).toHaveBeenCalledWith('dep-1')
  })

  it('surfaces the query error message', () => {
    queryError.value = new Error('加载部门失败')
    const wrapper = mount(DepartmentsPage)
    expect(wrapper.find('[data-testid="department-error"]').text()).toBe('加载部门失败')
  })
})

import type { Organization } from '@muon/enterprise-contracts'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import OrganizationsPage from '@/pages/OrganizationsPage.vue'

const organizations = ref<Organization[]>([])
const queryError = ref<unknown>(null)
const mutateAsync = vi.fn()
const isPending = ref(false)
const mutationError = ref<unknown>(null)

vi.mock('@/queries/useOrganizations', () => ({
  useOrganizations: () => ({ data: organizations, error: queryError }),
  useCreateOrganization: () => ({ mutateAsync, isPending, error: mutationError }),
}))

function makeOrganization(overrides: Partial<Organization>): Organization {
  return {
    id: 'org-1',
    name: '组织一',
    slug: 'org-one',
    status: 'active',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  } as Organization
}

describe('organizationsPage', () => {
  beforeEach(() => {
    organizations.value = []
    queryError.value = null
    isPending.value = false
    mutationError.value = null
    mutateAsync.mockReset()
    mutateAsync.mockResolvedValue(undefined)
  })

  it('renders organization rows from useOrganizations', () => {
    organizations.value = [
      makeOrganization({ id: 'org-1', name: '组织一', slug: 'org-one' }),
      makeOrganization({ id: 'org-2', name: '组织二', slug: 'org-two' }),
    ]

    const wrapper = mount(OrganizationsPage)

    const rows = wrapper.findAll('.organization-row')
    expect(rows).toHaveLength(2)
    expect(wrapper.text()).toContain('组织一')
    expect(wrapper.text()).toContain('组织二')
    expect(wrapper.text()).toContain('2 / 2 个组织')
  })

  it('submits a create with the form payload', async () => {
    const wrapper = mount(OrganizationsPage)

    const fields: Array<[string, string]> = [
      ['组织名称', '新组织'],
      ['组织标识', 'new-org'],
      ['Owner 用户名', 'owner'],
      ['Owner 邮箱', 'owner@example.com'],
      ['Owner 显示名称', 'Owner'],
      ['Owner 初始密码，至少 12 位', 'super-secret-pw'],
    ]
    for (const [placeholder, value] of fields) {
      const input = wrapper.find(`input[placeholder="${placeholder}"]`)
      expect(input.exists()).toBe(true)
      await input.setValue(value)
    }

    await wrapper.find('form.organization-form').trigger('submit')
    await flushPromises()

    expect(mutateAsync).toHaveBeenCalledTimes(1)
    expect(mutateAsync).toHaveBeenCalledWith({
      organizationName: '新组织',
      organizationSlug: 'new-org',
      ownerUsername: 'owner',
      ownerEmail: 'owner@example.com',
      ownerDisplayName: 'Owner',
      ownerPassword: 'super-secret-pw',
    })
  })

  it('does not submit when the form is incomplete', async () => {
    const wrapper = mount(OrganizationsPage)

    await wrapper.find('form.organization-form').trigger('submit')
    await flushPromises()

    expect(mutateAsync).not.toHaveBeenCalled()
  })
})

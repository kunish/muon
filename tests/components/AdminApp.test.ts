import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminApp from '../../apps/admin/src/AdminApp.vue'
import { createAdminUser, createOrganization, listAuditLogs, listOrganizations, listUsers, loginAdmin, resetAdminUserPassword, updateAdminUser } from '../../apps/admin/src/api'

vi.mock('../../apps/admin/src/api', () => ({
  createAdminUser: vi.fn(async () => ({
    user: {
      id: 'user-alice',
      organizationId: 'org-1',
      username: 'alice',
      email: 'alice@muon.local',
      displayName: 'Alice',
      status: 'active',
      mustChangePassword: true,
      roles: ['member'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })),
  createOrganization: vi.fn(async () => ({
    organization: {
      id: 'org-beta',
      slug: 'beta',
      name: 'Beta Team',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    owner: {
      id: 'user-beta-owner',
      organizationId: 'org-beta',
      username: 'beta-owner',
      email: 'owner@beta.test',
      displayName: 'Beta Owner',
      status: 'active',
      mustChangePassword: false,
      roles: ['owner'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })),
  installMuon: vi.fn(),
  listAuditLogs: vi.fn(async () => ({ auditLogs: [] })),
  listOrganizations: vi.fn(async () => ({
    organizations: [
      {
        id: 'org-1',
        slug: 'muon',
        name: 'Muon',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  })),
  listUsers: vi.fn(async () => ({
    users: [
      {
        id: 'user-owner',
        organizationId: 'org-1',
        username: 'owner',
        email: 'owner@muon.local',
        displayName: 'Owner',
        status: 'active',
        mustChangePassword: false,
        roles: ['owner'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  })),
  loginAdmin: vi.fn(async () => ({
    session: {
      accessToken: 'login-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    },
    user: {
      id: 'user-owner',
      organizationId: 'org-1',
      username: 'owner',
      email: 'owner@muon.local',
      displayName: 'Owner',
      status: 'active',
      mustChangePassword: false,
      roles: ['owner'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })),
  resetAdminUserPassword: vi.fn(async () => ({
    user: {
      id: 'user-owner',
      organizationId: 'org-1',
      username: 'owner',
      email: 'owner@muon.local',
      displayName: 'Owner',
      status: 'active',
      mustChangePassword: false,
      roles: ['owner'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })),
  updateAdminUser: vi.fn(async () => ({
    user: {
      id: 'user-owner',
      organizationId: 'org-1',
      username: 'principal-owner',
      email: 'principal@muon.local',
      displayName: 'Principal Owner',
      status: 'active',
      mustChangePassword: false,
      roles: ['owner'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })),
}))

describe('adminApp', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('shows the install wizard when Muon is not installed', async () => {
    const wrapper = mount(AdminApp, {
      props: {
        initialInstalled: false,
      },
    })

    expect(wrapper.text()).toContain('创建组织')
    expect(wrapper.text()).toContain('超级管理员')
  })

  it('shows the administrator login after install', async () => {
    const wrapper = mount(AdminApp, {
      props: {
        initialInstalled: true,
      },
    })

    expect(wrapper.text()).toContain('进入组织后台')
    expect(wrapper.text()).toContain('登录后台')
  })

  it('persists the admin session after login', async () => {
    const wrapper = mount(AdminApp, {
      props: {
        initialInstalled: true,
      },
    })

    await wrapper.find('input[type="password"]').setValue('correct horse battery staple')
    await wrapper.find('form.install-form').trigger('submit')

    await vi.waitFor(() => {
      expect(loginAdmin).toHaveBeenCalled()
    })
    expect(localStorage.getItem('muon_admin_token')).toBe('login-token')
  })

  it('restores the admin session after a page refresh', async () => {
    localStorage.setItem('muon_admin_token', 'stored-token')

    const wrapper = mount(AdminApp, {
      props: {
        initialInstalled: true,
      },
    })

    await vi.waitFor(() => {
      expect(listUsers).toHaveBeenCalledWith('stored-token')
    })
    expect(wrapper.text()).toContain('组织、用户与安全')
  })

  it('shows the user administration surface for signed-in admins', async () => {
    const wrapper = mount(AdminApp, {
      props: {
        initialInstalled: true,
        initialAdminToken: 'admin-token',
      },
    })

    await vi.waitFor(() => {
      expect(listUsers).toHaveBeenCalledWith('admin-token')
    })
    expect(listOrganizations).toHaveBeenCalledWith('admin-token')
    expect(wrapper.text()).toContain('组织管理')
    expect(wrapper.text()).toContain('用户管理')
    expect(wrapper.text()).toContain('审计日志')
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="edit-user-user-owner"]').exists()).toBe(true)
    })
    expect((wrapper.get('[data-testid="edit-user-user-owner"] input[placeholder="编辑显示名称"]').element as HTMLInputElement).value).toBe('Owner')
  })

  it('creates users from the administration surface', async () => {
    const wrapper = mount(AdminApp, {
      props: {
        initialInstalled: true,
        initialAdminToken: 'admin-token',
      },
    })

    await vi.waitFor(() => {
      expect(listAuditLogs).toHaveBeenCalled()
    })

    await wrapper.find('input[placeholder="用户名"]').setValue('alice')
    await wrapper.find('input[placeholder="邮箱"]').setValue('alice@muon.local')
    await wrapper.find('input[placeholder="显示名称"]').setValue('Alice')
    await wrapper.find('input[placeholder="初始密码，至少 12 位"]').setValue('temporary password 123')
    await wrapper.find('form.user-form').trigger('submit')

    await vi.waitFor(() => {
      expect(createAdminUser).toHaveBeenCalledWith('admin-token', {
        username: 'alice',
        email: 'alice@muon.local',
        displayName: 'Alice',
        initialPassword: 'temporary password 123',
        roles: ['member'],
      })
    })
  })

  it('updates owner accounts and resets their passwords from the administration surface', async () => {
    const wrapper = mount(AdminApp, {
      props: {
        initialInstalled: true,
        initialAdminToken: 'admin-token',
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="edit-user-user-owner"]').exists()).toBe(true)
    })

    const editForm = wrapper.get('[data-testid="edit-user-user-owner"]')
    await editForm.find('input[placeholder="编辑用户名"]').setValue('principal-owner')
    await editForm.find('input[placeholder="编辑邮箱"]').setValue('principal@muon.local')
    await editForm.find('input[placeholder="编辑显示名称"]').setValue('Principal Owner')
    await editForm.trigger('submit')

    await vi.waitFor(() => {
      expect(updateAdminUser).toHaveBeenCalledWith('admin-token', 'user-owner', {
        username: 'principal-owner',
        email: 'principal@muon.local',
        displayName: 'Principal Owner',
        roles: ['owner'],
      })
    })

    const passwordForm = wrapper.get('[data-testid="reset-password-user-owner"]')
    await passwordForm.find('input[placeholder="新密码，至少 12 位"]').setValue('new owner passphrase')
    await passwordForm.trigger('submit')

    await vi.waitFor(() => {
      expect(resetAdminUserPassword).toHaveBeenCalledWith('admin-token', 'user-owner', {
        newPassword: 'new owner passphrase',
        mustChangePassword: false,
      })
    })
  })

  it('creates organizations from the administration surface', async () => {
    const wrapper = mount(AdminApp, {
      props: {
        initialInstalled: true,
        initialAdminToken: 'admin-token',
      },
    })

    await vi.waitFor(() => {
      expect(listOrganizations).toHaveBeenCalled()
    })

    await wrapper.find('input[placeholder="组织名称"]').setValue('Beta Team')
    await wrapper.find('input[placeholder="组织标识"]').setValue('beta')
    await wrapper.find('input[placeholder="Owner 用户名"]').setValue('beta-owner')
    await wrapper.find('input[placeholder="Owner 邮箱"]').setValue('owner@beta.test')
    await wrapper.find('input[placeholder="Owner 显示名称"]').setValue('Beta Owner')
    await wrapper.find('input[placeholder="Owner 初始密码，至少 12 位"]').setValue('correct horse battery staple')
    await wrapper.find('form.organization-form').trigger('submit')

    await vi.waitFor(() => {
      expect(createOrganization).toHaveBeenCalledWith('admin-token', {
        organizationName: 'Beta Team',
        organizationSlug: 'beta',
        ownerUsername: 'beta-owner',
        ownerEmail: 'owner@beta.test',
        ownerDisplayName: 'Beta Owner',
        ownerPassword: 'correct horse battery staple',
      })
    })
  })
})

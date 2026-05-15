import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import AdminApp from '../../apps/admin/src/AdminApp.vue'
import { changeOwnPassword, createAdminUser, createOrganization, getAdminMe, listAuditLogs, listOrganizations, listUsers, loginAdmin, logoutAdmin, resetAdminUserPassword, updateAdminUser } from '../../apps/admin/src/api'
import { createAdminRouter } from '../../apps/admin/src/router'

vi.mock('../../apps/admin/src/api', () => ({
  changeOwnPassword: vi.fn(async () => ({
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
  getAdminMe: vi.fn(async () => ({
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
      {
        id: 'org-2',
        slug: 'beta',
        name: 'Beta Team',
        status: 'suspended',
        createdAt: new Date(Date.now() - 86_400_000).toISOString(),
        updatedAt: new Date(Date.now() - 3_600_000).toISOString(),
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
      {
        id: 'user-disabled',
        organizationId: 'org-1',
        username: 'disabled-user',
        email: 'disabled@muon.local',
        displayName: 'Disabled User',
        status: 'disabled',
        mustChangePassword: true,
        roles: ['member'],
        createdAt: new Date(Date.now() - 86_400_000).toISOString(),
        updatedAt: new Date(Date.now() - 3_600_000).toISOString(),
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
  logoutAdmin: vi.fn(async () => ({ ok: true })),
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

vi.mocked(listAuditLogs).mockImplementation(async () => ({
  auditLogs: [
    {
      id: 'audit-created',
      organizationId: 'org-1',
      actorUserId: 'user-owner',
      action: 'user.created',
      targetType: 'user',
      targetId: 'user-disabled',
      metadata: { username: 'disabled-user', roles: ['member'] },
      ipAddress: null,
      userAgent: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'audit-password',
      organizationId: 'org-1',
      actorUserId: 'user-owner',
      action: 'user.password_reset',
      targetType: 'user',
      targetId: 'user-owner',
      metadata: { username: 'owner', mustChangePassword: true },
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    },
  ],
}))

async function mountAdminApp(options: {
  props?: InstanceType<typeof AdminApp>['$props']
  route?: string
} = {}) {
  const router = createAdminRouter(createMemoryHistory())
  await router.push(options.route ?? '/organizations')
  const wrapper = mount(AdminApp, {
    props: options.props,
    global: {
      plugins: [router],
    },
  })
  await router.isReady()

  return { router, wrapper }
}

async function clickAdminSection(
  wrapper: ReturnType<typeof mount>,
  router: ReturnType<typeof createAdminRouter>,
  section: 'audit' | 'organizations' | 'users',
  path: string,
) {
  await wrapper.get(`[data-section="${section}"]`).trigger('click')
  await vi.waitFor(() => {
    expect(router.currentRoute.value.path).toBe(path)
  })
}

describe('adminApp', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('shows the install wizard when Muon is not installed', async () => {
    const { wrapper } = await mountAdminApp({
      props: {
        initialInstalled: false,
      },
    })

    expect(wrapper.text()).toContain('创建组织')
    expect(wrapper.text()).toContain('超级管理员')
  })

  it('shows the administrator login after install', async () => {
    const { wrapper } = await mountAdminApp({
      props: {
        initialInstalled: true,
      },
    })

    expect(wrapper.text()).toContain('进入组织后台')
    expect(wrapper.text()).toContain('登录后台')
  })

  it('persists the admin session after login', async () => {
    const { wrapper } = await mountAdminApp({
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

    const { wrapper } = await mountAdminApp({
      props: {
        initialInstalled: true,
      },
    })

    await vi.waitFor(() => {
      expect(listUsers).toHaveBeenCalledWith('stored-token')
    })
    expect(wrapper.text()).toContain('组织、用户与安全')
  })

  it('does not call getAdminMe when there is no stored token', async () => {
    expect(window.localStorage.getItem('muon_admin_token')).toBe(null)

    const wrapper = mount(AdminApp, {
      props: { initialInstalled: true },
      global: {
        plugins: [createAdminRouter(createMemoryHistory())],
      },
    })
    await flushPromises()

    expect(getAdminMe).not.toHaveBeenCalled()
    expect(listOrganizations).not.toHaveBeenCalled()
    expect(wrapper.find('input[autocomplete="organization"]').exists()).toBe(true)
  })

  it('shows the user administration surface for signed-in admins', async () => {
    const { router, wrapper } = await mountAdminApp({
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
    await clickAdminSection(wrapper, router, 'users', '/users')
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="edit-user-user-owner"]').exists()).toBe(true)
    })
    expect((wrapper.get('[data-testid="edit-user-user-owner"] input[placeholder="编辑显示名称"]').element as HTMLInputElement).value).toBe('Owner')
  })

  it('switches dashboard panels from the sidebar navigation', async () => {
    const { router, wrapper } = await mountAdminApp({
      props: {
        initialInstalled: true,
        initialAdminToken: 'admin-token',
      },
    })

    await vi.waitFor(() => {
      expect(listAuditLogs).toHaveBeenCalled()
    })

    expect(wrapper.find('form.organization-form').exists()).toBe(true)
    expect(wrapper.find('form.user-form').exists()).toBe(false)
    expect(wrapper.find('[aria-label="审计日志列表"]').exists()).toBe(false)

    await clickAdminSection(wrapper, router, 'users', '/users')

    expect(wrapper.find('form.organization-form').exists()).toBe(false)
    expect(wrapper.find('form.user-form').exists()).toBe(true)
    expect(wrapper.find('[aria-label="审计日志列表"]').exists()).toBe(false)

    await clickAdminSection(wrapper, router, 'audit', '/audit')

    expect(wrapper.find('form.organization-form').exists()).toBe(false)
    expect(wrapper.find('form.user-form').exists()).toBe(false)
    expect(wrapper.find('[aria-label="审计日志列表"]').exists()).toBe(true)

    await clickAdminSection(wrapper, router, 'organizations', '/organizations')

    expect(wrapper.find('form.organization-form').exists()).toBe(true)
    expect(wrapper.find('form.user-form').exists()).toBe(false)
    expect(wrapper.find('[aria-label="审计日志列表"]').exists()).toBe(false)
  })

  it('routes directly to admin panels and updates navigation links', async () => {
    const { router, wrapper } = await mountAdminApp({
      route: '/users',
      props: {
        initialInstalled: true,
        initialAdminToken: 'admin-token',
      },
    })

    await vi.waitFor(() => {
      expect(listAuditLogs).toHaveBeenCalled()
    })

    expect(wrapper.find('form.user-form').exists()).toBe(true)
    expect(router.currentRoute.value.name).toBe('admin-users')
    expect(wrapper.get('[data-section="users"]').attributes('aria-current')).toBe('page')

    await clickAdminSection(wrapper, router, 'audit', '/audit')

    expect(wrapper.find('[aria-label="审计日志列表"]').exists()).toBe(true)

    await router.push('/organizations')
    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('admin-organizations')
    })

    expect(wrapper.find('form.organization-form').exists()).toBe(true)
    expect(wrapper.get('[data-section="organizations"]').attributes('aria-current')).toBe('page')
  })

  it('routes admin path URLs to their panels', async () => {
    const { wrapper } = await mountAdminApp({
      route: '/audit',
      props: {
        initialInstalled: true,
        initialAdminToken: 'admin-token',
      },
    })

    await vi.waitFor(() => {
      expect(listAuditLogs).toHaveBeenCalled()
    })

    expect(wrapper.find('[aria-label="审计日志列表"]').exists()).toBe(true)
    expect(wrapper.get('[data-section="audit"]').attributes('aria-current')).toBe('page')
  })

  it('refreshes dashboard data and signs out from the admin header', async () => {
    localStorage.setItem('muon_admin_token', 'stored-token')
    const { wrapper } = await mountAdminApp({
      props: {
        initialInstalled: true,
      },
    })

    await vi.waitFor(() => {
      expect(listUsers).toHaveBeenCalledTimes(1)
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('组织 2')
      expect(wrapper.text()).toContain('用户 2')
      expect(wrapper.text()).toContain('审计 2')
    })

    await wrapper.get('button[data-testid="refresh-dashboard"]').trigger('click')
    await vi.waitFor(() => {
      expect(listUsers).toHaveBeenCalledTimes(2)
    })

    await wrapper.get('button[data-testid="logout-admin"]').trigger('click')

    expect(localStorage.getItem('muon_admin_token')).toBeNull()
    expect(wrapper.text()).toContain('进入组织后台')
    expect(wrapper.find('nav[aria-label="管理导航"]').exists()).toBe(false)
  })

  it('filters organizations, users, and audit logs inside their management panels', async () => {
    const { router, wrapper } = await mountAdminApp({
      props: {
        initialInstalled: true,
        initialAdminToken: 'admin-token',
      },
    })

    await vi.waitFor(() => {
      expect(listAuditLogs).toHaveBeenCalled()
    })

    await wrapper.get('input[data-testid="organization-search"]').setValue('beta')

    const organizationPanel = wrapper.get('[data-testid="organizations-panel"]')
    expect(organizationPanel.text()).toContain('Beta Team')
    expect(organizationPanel.text()).not.toContain('Muon')

    await clickAdminSection(wrapper, router, 'users', '/users')
    await wrapper.get('input[data-testid="user-search"]').setValue('disabled')
    await wrapper.get('select[data-testid="user-status-filter"]').setValue('disabled')

    const usersPanel = wrapper.get('[data-testid="users-panel"]')
    expect(usersPanel.text()).toContain('disabled-user')
    expect(usersPanel.text()).not.toContain('owner@muon.local')

    await clickAdminSection(wrapper, router, 'audit', '/audit')
    await wrapper.get('input[data-testid="audit-search"]').setValue('password')

    const auditPanel = wrapper.get('[data-testid="audit-panel"]')
    expect(auditPanel.text()).toContain('user.password_reset')
    expect(auditPanel.text()).not.toContain('user.created')
  })

  it('updates user status and controls password reset change requirements', async () => {
    const { wrapper } = await mountAdminApp({
      route: '/users',
      props: {
        initialInstalled: true,
        initialAdminToken: 'admin-token',
      },
    })

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="edit-user-user-owner"]').exists()).toBe(true)
    })

    await wrapper.get('button[data-testid="toggle-user-status-user-owner"]').trigger('click')

    await vi.waitFor(() => {
      expect(updateAdminUser).toHaveBeenCalledWith('admin-token', 'user-owner', {
        status: 'disabled',
      })
    })

    const passwordForm = wrapper.get('[data-testid="reset-password-user-owner"]')
    await passwordForm.find('input[placeholder="新密码，至少 12 位"]').setValue('new owner passphrase')
    await passwordForm.find('input[data-testid="must-change-password-user-owner"]').setValue(true)
    await passwordForm.trigger('submit')

    await vi.waitFor(() => {
      expect(resetAdminUserPassword).toHaveBeenCalledWith('admin-token', 'user-owner', {
        newPassword: 'new owner passphrase',
        mustChangePassword: true,
      })
    })
  })

  it('creates users from the administration surface', async () => {
    const { wrapper } = await mountAdminApp({
      route: '/users',
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
    const { wrapper } = await mountAdminApp({
      route: '/users',
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
    const { wrapper } = await mountAdminApp({
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

  it('validates a stored admin token on mount before showing the dashboard', async () => {
    window.localStorage.setItem('muon_admin_token', 'stored-token')
    const wrapper = mount(AdminApp, {
      props: { initialInstalled: true },
      global: {
        plugins: [createAdminRouter(createMemoryHistory())],
      },
    })
    await flushPromises()

    expect(getAdminMe).toHaveBeenCalledWith('stored-token')
    expect(listOrganizations).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="organizations-panel"]').exists()).toBe(true)
  })

  it('clears the stored token and falls back to the login form when getAdminMe rejects with auth error', async () => {
    window.localStorage.setItem('muon_admin_token', 'stale-token')
    ;(getAdminMe as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Admin authentication required'))

    const wrapper = mount(AdminApp, {
      props: { initialInstalled: true },
      global: {
        plugins: [createAdminRouter(createMemoryHistory())],
      },
    })
    await flushPromises()

    expect(window.localStorage.getItem('muon_admin_token')).toBe(null)
    expect(wrapper.find('input[autocomplete="organization"]').exists()).toBe(true)
    expect(listOrganizations).not.toHaveBeenCalled()
  })

  it('does not call refreshDashboard when the bootstrap user has mustChangePassword=true', async () => {
    window.localStorage.setItem('muon_admin_token', 'must-change-token')
    ;(getAdminMe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: {
        id: 'user-must-change',
        organizationId: 'org-1',
        username: 'novice',
        email: 'novice@muon.local',
        displayName: 'Novice',
        status: 'active',
        mustChangePassword: true,
        roles: ['member'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })

    mount(AdminApp, {
      props: { initialInstalled: true },
      global: {
        plugins: [createAdminRouter(createMemoryHistory())],
      },
    })
    await flushPromises()

    expect(listOrganizations).not.toHaveBeenCalled()
    expect(listUsers).not.toHaveBeenCalled()
  })

  it('shows the forced-change-password overlay when bootstrap sees mustChangePassword=true', async () => {
    window.localStorage.setItem('muon_admin_token', 'must-change-token')
    ;(getAdminMe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: {
        id: 'user-must-change',
        organizationId: 'org-1',
        username: 'novice',
        email: 'novice@muon.local',
        displayName: 'Novice',
        status: 'active',
        mustChangePassword: true,
        roles: ['member'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })

    const wrapper = mount(AdminApp, {
      props: { initialInstalled: true },
      global: {
        plugins: [createAdminRouter(createMemoryHistory())],
      },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="force-change-password"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="organizations-panel"]').exists()).toBe(false)
  })

  it('submitting the overlay form changes the password and loads the dashboard', async () => {
    window.localStorage.setItem('muon_admin_token', 'must-change-token')
    ;(getAdminMe as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        user: {
          id: 'user-must-change',
          organizationId: 'org-1',
          username: 'novice',
          email: 'novice@muon.local',
          displayName: 'Novice',
          status: 'active',
          mustChangePassword: true,
          roles: ['member'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })

    const wrapper = mount(AdminApp, {
      props: { initialInstalled: true },
      global: {
        plugins: [createAdminRouter(createMemoryHistory())],
      },
    })
    await flushPromises()

    await wrapper.find('[data-testid="force-change-password-current"]').setValue('correct horse battery staple')
    await wrapper.find('[data-testid="force-change-password-new"]').setValue('a much better passphrase!')
    await wrapper.find('[data-testid="force-change-password"]').trigger('submit.prevent')
    await flushPromises()

    expect(changeOwnPassword).toHaveBeenCalledWith('must-change-token', {
      currentPassword: 'correct horse battery staple',
      newPassword: 'a much better passphrase!',
    })
    expect(wrapper.find('[data-testid="force-change-password"]').exists()).toBe(false)
    expect(listOrganizations).toHaveBeenCalled()
  })

  it('shows an inline error when changeOwnPassword fails', async () => {
    window.localStorage.setItem('muon_admin_token', 'must-change-token')
    ;(getAdminMe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: {
        id: 'user-must-change',
        organizationId: 'org-1',
        username: 'novice',
        email: 'novice@muon.local',
        displayName: 'Novice',
        status: 'active',
        mustChangePassword: true,
        roles: ['member'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
    ;(changeOwnPassword as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Invalid credentials'))

    const wrapper = mount(AdminApp, {
      props: { initialInstalled: true },
      global: {
        plugins: [createAdminRouter(createMemoryHistory())],
      },
    })
    await flushPromises()

    await wrapper.find('[data-testid="force-change-password-current"]').setValue('wrong')
    await wrapper.find('[data-testid="force-change-password-new"]').setValue('a much better passphrase!')
    await wrapper.find('[data-testid="force-change-password"]').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('[data-testid="force-change-password-error"]').text()).toMatch(/credentials/i)
    expect(wrapper.find('[data-testid="force-change-password"]').exists()).toBe(true)
  })

  it('calls logoutAdmin before clearing the stored token when the user logs out', async () => {
    window.localStorage.setItem('muon_admin_token', 'session-token')
    const wrapper = mount(AdminApp, {
      props: { initialInstalled: true },
      global: {
        plugins: [createAdminRouter(createMemoryHistory())],
      },
    })
    await flushPromises()

    await wrapper.find('[data-testid="logout-admin"]').trigger('click')
    await flushPromises()

    expect(logoutAdmin).toHaveBeenCalledWith('session-token')
    expect(window.localStorage.getItem('muon_admin_token')).toBe(null)
  })

  it('clears the stored token even when logoutAdmin rejects', async () => {
    window.localStorage.setItem('muon_admin_token', 'session-token')
    ;(logoutAdmin as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network down'))

    const wrapper = mount(AdminApp, {
      props: { initialInstalled: true },
      global: {
        plugins: [createAdminRouter(createMemoryHistory())],
      },
    })
    await flushPromises()

    await wrapper.find('[data-testid="logout-admin"]').trigger('click')
    await flushPromises()

    expect(window.localStorage.getItem('muon_admin_token')).toBe(null)
  })
})

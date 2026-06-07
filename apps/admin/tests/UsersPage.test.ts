import type { DeviceSessionPublic, EnterpriseUser } from '@muon/enterprise-contracts'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import UsersPage from '@/pages/UsersPage.vue'

// 自动卸载每个 wrapper，避免上一个测试残留的子组件在 beforeEach 改 mock ref 时反应式重渲染，
// 污染 lastSessionsEnabled 等模块级共享状态。
enableAutoUnmount(afterEach)

const users = ref<EnterpriseUser[]>([])
const queryError = ref<unknown>(null)

const createMutateAsync = vi.fn()
const createIsPending = ref(false)
const createError = ref<unknown>(null)

const updateMutateAsync = vi.fn()
const updateIsPending = ref(false)
const updateError = ref<unknown>(null)

const resetMutateAsync = vi.fn()
const resetIsPending = ref(false)
const resetError = ref<unknown>(null)

const sessions = ref<DeviceSessionPublic[]>([])
const sessionsIsFetching = ref(false)
const sessionsError = ref<unknown>(null)
// 记录最近一次 useUserSessions 的 enabled getter，用于断言懒加载（仅展开后才 enabled）。
let lastSessionsEnabled: (() => boolean) | null = null

const revokeMutateAsync = vi.fn()
const revokeIsPending = ref(false)
const revokeError = ref<unknown>(null)

vi.mock('@/queries/useUsers', () => ({
  useUsers: () => ({ data: users, error: queryError }),
  useCreateUser: () => ({ mutateAsync: createMutateAsync, isPending: createIsPending, error: createError }),
  useUpdateUser: () => ({ mutateAsync: updateMutateAsync, isPending: updateIsPending, error: updateError }),
  useResetUserPassword: () => ({ mutateAsync: resetMutateAsync, isPending: resetIsPending, error: resetError }),
  useUserSessions: (_userId: string, enabled: () => boolean) => {
    lastSessionsEnabled = enabled
    return { data: sessions, isFetching: sessionsIsFetching, error: sessionsError }
  },
  useRevokeUserSession: () => ({ mutateAsync: revokeMutateAsync, isPending: revokeIsPending, error: revokeError }),
}))

function makeUser(overrides: Partial<EnterpriseUser>): EnterpriseUser {
  return {
    id: 'user-1',
    organizationId: 'org-1',
    username: 'alice',
    email: 'alice@example.com',
    displayName: '爱丽丝',
    roles: ['member'],
    status: 'active',
    mustChangePassword: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  } as EnterpriseUser
}

function makeSession(overrides: Partial<DeviceSessionPublic>): DeviceSessionPublic {
  return {
    id: 'sess-1',
    deviceName: 'MacBook',
    createdAt: '2024-01-01T00:00:00.000Z',
    expiresAt: '2024-02-01T00:00:00.000Z',
    ...overrides,
  } as DeviceSessionPublic
}

describe('usersPage', () => {
  beforeEach(() => {
    users.value = []
    queryError.value = null
    createIsPending.value = false
    createError.value = null
    updateIsPending.value = false
    updateError.value = null
    resetIsPending.value = false
    resetError.value = null
    sessions.value = []
    sessionsIsFetching.value = false
    sessionsError.value = null
    lastSessionsEnabled = null
    revokeIsPending.value = false
    revokeError.value = null
    createMutateAsync.mockReset().mockResolvedValue(undefined)
    updateMutateAsync.mockReset().mockResolvedValue(undefined)
    resetMutateAsync.mockReset().mockResolvedValue(undefined)
    revokeMutateAsync.mockReset().mockResolvedValue(undefined)
  })

  it('renders user rows from useUsers', () => {
    users.value = [
      makeUser({ id: 'user-1', displayName: '爱丽丝' }),
      makeUser({ id: 'user-2', username: 'bob', displayName: '鲍勃' }),
    ]

    const wrapper = mount(UsersPage)

    expect(wrapper.findAll('.user-row')).toHaveLength(2)
    expect(wrapper.text()).toContain('爱丽丝')
    expect(wrapper.text()).toContain('鲍勃')
    expect(wrapper.text()).toContain('2 / 2 个用户')
  })

  it('shows the empty state when no users match', () => {
    const wrapper = mount(UsersPage)
    expect(wrapper.text()).toContain('没有匹配的用户')
  })

  it('submits a create with the form payload', async () => {
    const wrapper = mount(UsersPage)

    await wrapper.find('input[placeholder="用户名"]').setValue('carol')
    await wrapper.find('input[placeholder="邮箱"]').setValue('carol@example.com')
    await wrapper.find('input[placeholder="显示名称"]').setValue('卡萝尔')
    await wrapper.find('input[placeholder="初始密码，至少 12 位"]').setValue('super-secret-pw')
    await wrapper.find('[data-testid="user-role"]').setValue('admin')
    await wrapper.find('form[data-testid="user-form"]').trigger('submit')
    await flushPromises()

    expect(createMutateAsync).toHaveBeenCalledTimes(1)
    expect(createMutateAsync).toHaveBeenCalledWith({
      username: 'carol',
      email: 'carol@example.com',
      displayName: '卡萝尔',
      initialPassword: 'super-secret-pw',
      roles: ['admin'],
    })
  })

  it('does not submit a create with a short password', async () => {
    const wrapper = mount(UsersPage)

    await wrapper.find('input[placeholder="用户名"]').setValue('carol')
    await wrapper.find('input[placeholder="邮箱"]').setValue('carol@example.com')
    await wrapper.find('input[placeholder="显示名称"]').setValue('卡萝尔')
    await wrapper.find('input[placeholder="初始密码，至少 12 位"]').setValue('short')
    await wrapper.find('form[data-testid="user-form"]').trigger('submit')
    await flushPromises()

    expect(createMutateAsync).not.toHaveBeenCalled()
  })

  it('updates a user after editing the draft display name', async () => {
    users.value = [makeUser({ id: 'user-1' })]

    const wrapper = mount(UsersPage)

    await wrapper.find('input[placeholder="编辑显示名称"]').setValue('爱丽丝改名')
    await wrapper.find('form[data-testid="edit-user-user-1"]').trigger('submit')
    await flushPromises()

    expect(updateMutateAsync).toHaveBeenCalledWith({
      userId: 'user-1',
      patch: {
        username: 'alice',
        email: 'alice@example.com',
        displayName: '爱丽丝改名',
        roles: ['member'],
      },
    })
  })

  it('toggles user status through the update mutation', async () => {
    users.value = [makeUser({ id: 'user-1', status: 'active' })]

    const wrapper = mount(UsersPage)

    await wrapper.find('[data-testid="toggle-user-status-user-1"]').trigger('click')
    await flushPromises()

    expect(updateMutateAsync).toHaveBeenCalledWith({ userId: 'user-1', patch: { status: 'disabled' } })
  })

  it('resets the password with the must-change flag', async () => {
    users.value = [makeUser({ id: 'user-1' })]

    const wrapper = mount(UsersPage)

    await wrapper.find('[data-testid="reset-password-user-1"] input[type="password"]').setValue('brand-new-pass-123')
    await wrapper.find('[data-testid="must-change-password-user-1"]').setValue(true)
    await wrapper.find('form[data-testid="reset-password-user-1"]').trigger('submit')
    await flushPromises()

    expect(resetMutateAsync).toHaveBeenCalledWith({
      userId: 'user-1',
      payload: { newPassword: 'brand-new-pass-123', mustChangePassword: true },
    })
  })

  it('does not reset the password when it is too short', async () => {
    users.value = [makeUser({ id: 'user-1' })]

    const wrapper = mount(UsersPage)

    await wrapper.find('[data-testid="reset-password-user-1"] input[type="password"]').setValue('short')
    await wrapper.find('form[data-testid="reset-password-user-1"]').trigger('submit')
    await flushPromises()

    expect(resetMutateAsync).not.toHaveBeenCalled()
  })

  it('lazy-loads sessions only after expanding, then revokes one', async () => {
    users.value = [makeUser({ id: 'user-1' })]
    sessions.value = [makeSession({ id: 'sess-1', deviceName: 'MacBook' })]

    const wrapper = mount(UsersPage)

    // 折叠时 enabled 应为 false（懒加载未触发）。
    expect(lastSessionsEnabled?.()).toBe(false)

    await wrapper.find('[data-testid="user-sessions-summary-user-1"]').trigger('click')
    await flushPromises()

    // 展开后 enabled 变 true，会话列表渲染。
    expect(lastSessionsEnabled?.()).toBe(true)
    expect(wrapper.text()).toContain('MacBook')

    await wrapper.find('[data-testid="user-sessions-revoke-sess-1"]').trigger('click')
    await flushPromises()

    expect(revokeMutateAsync).toHaveBeenCalledWith({ userId: 'user-1', sessionId: 'sess-1' })
  })

  it('surfaces the query error message', () => {
    queryError.value = new Error('加载用户失败')
    const wrapper = mount(UsersPage)
    expect(wrapper.find('[data-testid="user-error"]').text()).toBe('加载用户失败')
  })
})

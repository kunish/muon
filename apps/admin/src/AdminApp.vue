<script setup lang="ts">
import type { AuditLog, EnterpriseUser, Organization, UserRole, UserStatus } from '@muon/enterprise-contracts'
import { Button } from '@muon/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@muon/ui/card'
import { Input } from '@muon/ui/input'
import { Label } from '@muon/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@muon/ui/select'
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { createAdminUser, createOrganization, getAdminMe, installMuon, listAuditLogs, listOrganizations, listUsers, loginAdmin, resetAdminUserPassword, updateAdminUser } from './api'
import { adminSections, defaultAdminSection, isAdminSection } from './router'

const props = withDefaults(defineProps<{
  initialInstalled?: boolean
  initialAdminToken?: string
}>(), {
  initialInstalled: false,
  initialAdminToken: '',
})

const adminTokenStorageKey = 'muon_admin_token'
const route = useRoute()
const router = useRouter()

function readStoredAdminToken(): string {
  if (typeof window === 'undefined')
    return ''
  return window.localStorage.getItem(adminTokenStorageKey) ?? ''
}

const installed = ref(props.initialInstalled)
const adminToken = ref(props.initialAdminToken || readStoredAdminToken())
const mustChangePassword = ref(false)
const submitting = ref(false)
const loginSubmitting = ref(false)
const organizationSubmitting = ref(false)
const userSubmitting = ref(false)
const dashboardLoading = ref(false)
const error = ref('')
const loginError = ref('')
const organizationError = ref('')
const userError = ref('')
const organizations = ref<Organization[]>([])
const users = ref<EnterpriseUser[]>([])
const auditLogs = ref<AuditLog[]>([])
const organizationSearch = ref('')
const userSearch = ref('')
const userStatusFilter = ref<'all' | UserStatus>('all')
const auditSearch = ref('')
const userDrafts = reactive<Record<string, {
  displayName: string
  email: string
  role: UserRole
  username: string
}>>({})
const passwordDrafts = reactive<Record<string, string>>({})
const passwordPolicies = reactive<Record<string, boolean>>({})
const updatingUsers = reactive<Record<string, boolean>>({})
const resettingPasswords = reactive<Record<string, boolean>>({})
const form = reactive({
  organizationName: 'Muon',
  organizationSlug: 'muon',
  ownerUsername: 'owner',
  ownerEmail: 'owner@muon.local',
  ownerDisplayName: 'Owner',
  ownerPassword: '',
})
const loginForm = reactive({
  organizationSlug: 'muon',
  username: 'owner',
  password: '',
})
const userForm = reactive({
  username: '',
  email: '',
  displayName: '',
  initialPassword: '',
  role: 'member' as UserRole,
})
const organizationForm = reactive({
  organizationName: '',
  organizationSlug: '',
  ownerUsername: '',
  ownerEmail: '',
  ownerDisplayName: '',
  ownerPassword: '',
})

const canSubmitInstall = computed(() => {
  return form.organizationName
    && form.organizationSlug
    && form.ownerUsername
    && form.ownerEmail
    && form.ownerDisplayName
    && form.ownerPassword.length >= 12
})
const canLogin = computed(() => {
  return loginForm.organizationSlug && loginForm.username && loginForm.password
})
const canCreateUser = computed(() => {
  return userForm.username
    && userForm.email
    && userForm.displayName
    && userForm.initialPassword.length >= 12
})
const canCreateOrganization = computed(() => {
  return organizationForm.organizationName
    && organizationForm.organizationSlug
    && organizationForm.ownerUsername
    && organizationForm.ownerEmail
    && organizationForm.ownerDisplayName
    && organizationForm.ownerPassword.length >= 12
})

const loggedIn = computed(() => Boolean(adminToken.value))
const activeAdminSection = computed(() => {
  return isAdminSection(route.meta.adminSection) ? route.meta.adminSection : defaultAdminSection
})
const activeUsers = computed(() => users.value.filter(user => user.status === 'active').length)
const disabledUsers = computed(() => users.value.filter(user => user.status === 'disabled').length)
const filteredOrganizations = computed(() => {
  const query = organizationSearch.value.trim().toLowerCase()
  if (!query)
    return organizations.value
  return organizations.value.filter((organization) => {
    return [
      organization.name,
      organization.slug,
      organization.status,
      statusLabel(organization.status),
    ].some(value => value.toLowerCase().includes(query))
  })
})
const filteredUsers = computed(() => {
  const query = userSearch.value.trim().toLowerCase()
  return users.value.filter((user) => {
    if (userStatusFilter.value !== 'all' && user.status !== userStatusFilter.value)
      return false
    if (!query)
      return true
    return [
      user.username,
      user.email,
      user.displayName,
      user.status,
      statusLabel(user.status),
      user.roles.join(' '),
      user.roles.map(roleLabel).join(' '),
    ].some(value => value.toLowerCase().includes(query))
  })
})
const filteredAuditLogs = computed(() => {
  const query = auditSearch.value.trim().toLowerCase()
  if (!query)
    return auditLogs.value
  return auditLogs.value.filter((entry) => {
    return [
      entry.action,
      entry.targetType,
      entry.targetId ?? '',
      entry.actorUserId ?? '',
      metadataSummary(entry),
    ].some(value => value.toLowerCase().includes(query))
  })
})

function persistAdminToken(token: string) {
  adminToken.value = token
  if (typeof window !== 'undefined')
    window.localStorage.setItem(adminTokenStorageKey, token)
}

function clearAdminToken() {
  adminToken.value = ''
  void router.replace({ name: 'admin-organizations' })
  organizationSearch.value = ''
  userSearch.value = ''
  userStatusFilter.value = 'all'
  auditSearch.value = ''
  if (typeof window !== 'undefined')
    window.localStorage.removeItem(adminTokenStorageKey)
}

function isAuthenticationError(error: unknown) {
  return error instanceof Error && /authentication|credentials|required/i.test(error.message)
}

function syncUserDrafts(nextUsers: EnterpriseUser[]) {
  for (const user of nextUsers) {
    userDrafts[user.id] = {
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.roles[0] ?? 'member',
    }
    passwordDrafts[user.id] = ''
    passwordPolicies[user.id] = false
  }
}

function canUpdateUser(user: EnterpriseUser) {
  const draft = userDrafts[user.id]
  return Boolean(draft?.username && draft.email && draft.displayName && draft.role)
}

function canResetUserPassword(user: EnterpriseUser) {
  return (passwordDrafts[user.id]?.length ?? 0) >= 12
}

function roleLabel(role: UserRole) {
  return role === 'owner' ? 'Owner' : role === 'admin' ? '管理员' : '成员'
}

function statusLabel(status: UserStatus | Organization['status']) {
  return status === 'active' ? '正常' : status === 'disabled' ? '已停用' : '已暂停'
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function metadataSummary(entry: AuditLog) {
  const entries = Object.entries(entry.metadata)
  if (entries.length === 0)
    return '无附加信息'
  return entries.map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`).join('；')
}

async function refreshDashboard() {
  if (!adminToken.value)
    return

  dashboardLoading.value = true
  try {
    const token = adminToken.value
    const [organizationResult, userResult, auditResult] = await Promise.all([
      listOrganizations(token),
      listUsers(token),
      listAuditLogs(token),
    ])
    organizations.value = organizationResult.organizations
    users.value = userResult.users
    syncUserDrafts(userResult.users)
    auditLogs.value = auditResult.auditLogs
  }
  catch (err) {
    if (isAuthenticationError(err))
      clearAdminToken()
    else
      userError.value = err instanceof Error ? err.message : '加载后台数据失败'
  }
  finally {
    dashboardLoading.value = false
  }
}

async function submitLogin() {
  if (!canLogin.value || loginSubmitting.value)
    return

  loginSubmitting.value = true
  loginError.value = ''
  try {
    const result = await loginAdmin(loginForm)
    persistAdminToken(result.session.accessToken)
    await refreshDashboard()
  }
  catch (err) {
    loginError.value = err instanceof Error ? err.message : '登录失败'
  }
  finally {
    loginSubmitting.value = false
  }
}

async function submitInstall() {
  if (!canSubmitInstall.value || submitting.value)
    return

  submitting.value = true
  error.value = ''
  try {
    await installMuon(form)
    installed.value = true
    const result = await loginAdmin({
      organizationSlug: form.organizationSlug,
      username: form.ownerUsername,
      password: form.ownerPassword,
    })
    persistAdminToken(result.session.accessToken)
    await refreshDashboard()
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : '安装失败'
  }
  finally {
    submitting.value = false
  }
}

async function submitCreateOrganization() {
  if (!adminToken.value || !canCreateOrganization.value || organizationSubmitting.value)
    return

  organizationSubmitting.value = true
  organizationError.value = ''
  try {
    await createOrganization(adminToken.value, {
      organizationName: organizationForm.organizationName,
      organizationSlug: organizationForm.organizationSlug,
      ownerUsername: organizationForm.ownerUsername,
      ownerEmail: organizationForm.ownerEmail,
      ownerDisplayName: organizationForm.ownerDisplayName,
      ownerPassword: organizationForm.ownerPassword,
    })
    organizationForm.organizationName = ''
    organizationForm.organizationSlug = ''
    organizationForm.ownerUsername = ''
    organizationForm.ownerEmail = ''
    organizationForm.ownerDisplayName = ''
    organizationForm.ownerPassword = ''
    await refreshDashboard()
  }
  catch (err) {
    organizationError.value = err instanceof Error ? err.message : '创建组织失败'
  }
  finally {
    organizationSubmitting.value = false
  }
}

async function submitCreateUser() {
  if (!adminToken.value || !canCreateUser.value || userSubmitting.value)
    return

  userSubmitting.value = true
  userError.value = ''
  try {
    await createAdminUser(adminToken.value, {
      username: userForm.username,
      email: userForm.email,
      displayName: userForm.displayName,
      initialPassword: userForm.initialPassword,
      roles: [userForm.role],
    })
    userForm.username = ''
    userForm.email = ''
    userForm.displayName = ''
    userForm.initialPassword = ''
    userForm.role = 'member'
    await refreshDashboard()
  }
  catch (err) {
    userError.value = err instanceof Error ? err.message : '创建用户失败'
  }
  finally {
    userSubmitting.value = false
  }
}

async function submitUpdateUser(user: EnterpriseUser) {
  const draft = userDrafts[user.id]
  if (!adminToken.value || !draft || !canUpdateUser(user) || updatingUsers[user.id])
    return

  updatingUsers[user.id] = true
  userError.value = ''
  try {
    await updateAdminUser(adminToken.value, user.id, {
      username: draft.username,
      email: draft.email,
      displayName: draft.displayName,
      roles: [draft.role],
    })
    await refreshDashboard()
  }
  catch (err) {
    userError.value = err instanceof Error ? err.message : '更新用户失败'
  }
  finally {
    updatingUsers[user.id] = false
  }
}

async function toggleUserStatus(user: EnterpriseUser) {
  if (!adminToken.value || updatingUsers[user.id])
    return

  updatingUsers[user.id] = true
  userError.value = ''
  try {
    await updateAdminUser(adminToken.value, user.id, {
      status: user.status === 'active' ? 'disabled' : 'active',
    })
    await refreshDashboard()
  }
  catch (err) {
    userError.value = err instanceof Error ? err.message : '更新用户状态失败'
  }
  finally {
    updatingUsers[user.id] = false
  }
}

async function submitResetUserPassword(user: EnterpriseUser) {
  if (!adminToken.value || !canResetUserPassword(user) || resettingPasswords[user.id])
    return

  resettingPasswords[user.id] = true
  userError.value = ''
  try {
    await resetAdminUserPassword(adminToken.value, user.id, {
      newPassword: passwordDrafts[user.id],
      mustChangePassword: passwordPolicies[user.id] ?? false,
    })
    passwordDrafts[user.id] = ''
    await refreshDashboard()
  }
  catch (err) {
    userError.value = err instanceof Error ? err.message : '重置密码失败'
  }
  finally {
    resettingPasswords[user.id] = false
  }
}

async function bootstrap() {
  const token = adminToken.value
  if (!token)
    return
  try {
    const { user } = await getAdminMe(token)
    if (user.mustChangePassword) {
      mustChangePassword.value = true
      return
    }
    await refreshDashboard()
  }
  catch (err) {
    if (isAuthenticationError(err))
      clearAdminToken()
    else
      userError.value = err instanceof Error ? err.message : '加载后台数据失败'
  }
}

void bootstrap()
</script>

<template>
  <main class="admin-shell">
    <aside class="admin-sidebar">
      <div class="brand">
        Muon Admin
      </div>
      <nav v-if="loggedIn" class="nav-list" aria-label="管理导航">
        <RouterLink
          v-for="section in adminSections"
          :key="section.id"
          :to="{ name: section.routeName }"
          :class="{ active: activeAdminSection === section.id }"
          :aria-current="activeAdminSection === section.id ? 'page' : undefined"
          :data-section="section.id"
        >
          {{ section.label }}
        </RouterLink>
      </nav>
    </aside>

    <section v-if="!installed" class="admin-content install-layout">
      <div class="page-heading">
        <p>首次启动</p>
        <h1>创建组织</h1>
      </div>

      <form class="install-form" @submit.prevent="submitInstall">
        <Label class="grid gap-1.5">
          组织名称
          <Input v-model="form.organizationName" autocomplete="organization" />
        </Label>
        <Label class="grid gap-1.5">
          组织标识
          <Input v-model="form.organizationSlug" autocomplete="off" />
        </Label>
        <div class="form-section-title">
          超级管理员
        </div>
        <Label class="grid gap-1.5">
          用户名
          <Input v-model="form.ownerUsername" autocomplete="username" />
        </Label>
        <Label class="grid gap-1.5">
          邮箱
          <Input v-model="form.ownerEmail" autocomplete="email" />
        </Label>
        <Label class="grid gap-1.5">
          显示名称
          <Input v-model="form.ownerDisplayName" autocomplete="name" />
        </Label>
        <Label class="grid gap-1.5">
          初始密码
          <Input v-model="form.ownerPassword" type="password" autocomplete="new-password" />
        </Label>
        <p v-if="error" class="error">
          {{ error }}
        </p>
        <Button class="w-fit" type="submit" :disabled="!canSubmitInstall || submitting">
          {{ submitting ? '正在创建' : '创建组织' }}
        </Button>
      </form>
    </section>

    <section v-else-if="!loggedIn" class="admin-content install-layout">
      <div class="page-heading">
        <p>管理员登录</p>
        <h1>进入组织后台</h1>
      </div>

      <form class="install-form" @submit.prevent="submitLogin">
        <Label class="grid gap-1.5">
          组织标识
          <Input v-model="loginForm.organizationSlug" autocomplete="organization" />
        </Label>
        <Label class="grid gap-1.5">
          用户名
          <Input v-model="loginForm.username" autocomplete="username" />
        </Label>
        <Label class="grid gap-1.5">
          密码
          <Input v-model="loginForm.password" type="password" autocomplete="current-password" />
        </Label>
        <p v-if="loginError" class="error">
          {{ loginError }}
        </p>
        <Button class="w-fit" type="submit" :disabled="!canLogin || loginSubmitting">
          {{ loginSubmitting ? '正在登录' : '登录后台' }}
        </Button>
      </form>
    </section>

    <section v-else class="admin-content dashboard-layout">
      <div class="dashboard-header">
        <div class="page-heading">
          <p>组织后台</p>
          <h1>组织、用户与安全</h1>
        </div>
        <div class="dashboard-actions">
          <Button data-testid="refresh-dashboard" type="button" variant="outline" :disabled="dashboardLoading" @click="refreshDashboard">
            {{ dashboardLoading ? '刷新中' : '刷新数据' }}
          </Button>
          <Button data-testid="logout-admin" type="button" variant="secondary" @click="clearAdminToken">
            退出登录
          </Button>
        </div>
      </div>

      <div class="summary-grid" aria-label="后台概览">
        <div class="summary-card">
          <span>组织</span>
          <strong>组织 {{ organizations.length }}</strong>
        </div>
        <div class="summary-card">
          <span>用户</span>
          <strong>用户 {{ users.length }}</strong>
          <small>{{ activeUsers }} 正常 / {{ disabledUsers }} 停用</small>
        </div>
        <div class="summary-card">
          <span>审计</span>
          <strong>审计 {{ auditLogs.length }}</strong>
        </div>
      </div>

      <div class="panel-grid">
        <Card v-if="activeAdminSection === 'organizations'" id="organizations" class="wide-panel" data-testid="organizations-panel">
          <CardHeader>
            <CardTitle>组织管理</CardTitle>
            <CardDescription>创建新的组织，并为新组织设置独立 owner 账号。</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="panel-toolbar">
              <Input v-model="organizationSearch" data-testid="organization-search" placeholder="搜索组织名称、标识或状态" autocomplete="off" />
              <span>{{ filteredOrganizations.length }} / {{ organizations.length }} 个组织</span>
            </div>
            <form class="organization-form" @submit.prevent="submitCreateOrganization">
              <Input v-model="organizationForm.organizationName" placeholder="组织名称" autocomplete="off" />
              <Input v-model="organizationForm.organizationSlug" placeholder="组织标识" autocomplete="off" />
              <Input v-model="organizationForm.ownerUsername" placeholder="Owner 用户名" autocomplete="off" />
              <Input v-model="organizationForm.ownerEmail" placeholder="Owner 邮箱" autocomplete="off" />
              <Input v-model="organizationForm.ownerDisplayName" placeholder="Owner 显示名称" autocomplete="off" />
              <Input v-model="organizationForm.ownerPassword" type="password" placeholder="Owner 初始密码，至少 12 位" autocomplete="new-password" />
              <Button class="w-fit" type="submit" :disabled="!canCreateOrganization || organizationSubmitting">
                {{ organizationSubmitting ? '正在创建' : '新建组织' }}
              </Button>
            </form>
            <p v-if="organizationError" class="error">
              {{ organizationError }}
            </p>
            <div class="table-list" aria-label="组织列表">
              <div v-for="organization in filteredOrganizations" :key="organization.id" class="table-row organization-row">
                <strong>{{ organization.name }}</strong>
                <span>{{ organization.slug }}</span>
                <span>{{ statusLabel(organization.status) }}</span>
                <span>{{ formatDate(organization.createdAt) }}</span>
              </div>
              <div v-if="filteredOrganizations.length === 0" class="empty-state">
                没有匹配的组织
              </div>
            </div>
          </CardContent>
        </Card>

        <Card v-if="activeAdminSection === 'users'" id="users" class="wide-panel" data-testid="users-panel">
          <CardHeader>
            <CardTitle>用户管理</CardTitle>
            <CardDescription>创建成员、设置初始密码、调整角色与停用账号。</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="panel-toolbar">
              <Input v-model="userSearch" data-testid="user-search" placeholder="搜索用户名、邮箱、显示名称或角色" autocomplete="off" />
              <select v-model="userStatusFilter" data-testid="user-status-filter" aria-label="用户状态筛选">
                <option value="all">
                  全部状态
                </option>
                <option value="active">
                  正常
                </option>
                <option value="disabled">
                  已停用
                </option>
              </select>
              <span>{{ filteredUsers.length }} / {{ users.length }} 个用户</span>
            </div>
            <form class="user-form" @submit.prevent="submitCreateUser">
              <Input v-model="userForm.username" placeholder="用户名" autocomplete="off" />
              <Input v-model="userForm.email" placeholder="邮箱" autocomplete="off" />
              <Input v-model="userForm.displayName" placeholder="显示名称" autocomplete="off" />
              <Input v-model="userForm.initialPassword" type="password" placeholder="初始密码，至少 12 位" autocomplete="new-password" />
              <Select v-model="userForm.role">
                <SelectTrigger aria-label="角色">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">
                    成员
                  </SelectItem>
                  <SelectItem value="admin">
                    管理员
                  </SelectItem>
                  <SelectItem value="owner">
                    Owner
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button class="w-fit" type="submit" :disabled="!canCreateUser || userSubmitting">
                {{ userSubmitting ? '正在创建' : '新建用户' }}
              </Button>
            </form>
            <p v-if="userError" class="error">
              {{ userError }}
            </p>
            <div class="table-list" aria-label="用户列表">
              <div v-for="user in filteredUsers" :key="user.id" class="user-row">
                <div class="user-row-header">
                  <div>
                    <strong>{{ user.displayName }}</strong>
                    <span>{{ user.username }} · {{ user.email }}</span>
                  </div>
                  <div class="user-badges">
                    <span class="status-pill" :class="user.status">{{ statusLabel(user.status) }}</span>
                    <span>{{ user.roles.map(roleLabel).join(' / ') }}</span>
                    <span v-if="user.mustChangePassword">需改密</span>
                  </div>
                </div>
                <form class="user-edit-form" :data-testid="`edit-user-${user.id}`" @submit.prevent="submitUpdateUser(user)">
                  <Input v-model="userDrafts[user.id].username" placeholder="编辑用户名" autocomplete="off" />
                  <Input v-model="userDrafts[user.id].email" placeholder="编辑邮箱" autocomplete="off" />
                  <Input v-model="userDrafts[user.id].displayName" placeholder="编辑显示名称" autocomplete="off" />
                  <Select v-model="userDrafts[user.id].role">
                    <SelectTrigger aria-label="编辑角色">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">
                        成员
                      </SelectItem>
                      <SelectItem value="admin">
                        管理员
                      </SelectItem>
                      <SelectItem value="owner">
                        Owner
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" :disabled="!canUpdateUser(user) || updatingUsers[user.id]">
                    {{ updatingUsers[user.id] ? '正在保存' : '保存用户' }}
                  </Button>
                  <Button
                    :data-testid="`toggle-user-status-${user.id}`"
                    type="button"
                    variant="outline"
                    :disabled="updatingUsers[user.id]"
                    @click="toggleUserStatus(user)"
                  >
                    {{ user.status === 'active' ? '停用用户' : '启用用户' }}
                  </Button>
                </form>
                <form class="password-form" :data-testid="`reset-password-${user.id}`" @submit.prevent="submitResetUserPassword(user)">
                  <Input v-model="passwordDrafts[user.id]" type="password" placeholder="新密码，至少 12 位" autocomplete="new-password" />
                  <label class="checkbox-row">
                    <input v-model="passwordPolicies[user.id]" :data-testid="`must-change-password-${user.id}`" type="checkbox">
                    下次登录必须修改密码
                  </label>
                  <Button type="submit" :disabled="!canResetUserPassword(user) || resettingPasswords[user.id]">
                    {{ resettingPasswords[user.id] ? '正在重置' : '重置密码' }}
                  </Button>
                </form>
              </div>
              <div v-if="filteredUsers.length === 0" class="empty-state">
                没有匹配的用户
              </div>
            </div>
          </CardContent>
        </Card>

        <Card v-if="activeAdminSection === 'audit'" id="audit" class="wide-panel" data-testid="audit-panel">
          <CardHeader>
            <CardTitle>审计日志</CardTitle>
            <CardDescription>查看安装、登录、创建用户、重置密码、角色变更和 Matrix provision 记录。</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="panel-toolbar">
              <Input v-model="auditSearch" data-testid="audit-search" placeholder="搜索动作、目标、操作者或元数据" autocomplete="off" />
              <span>{{ filteredAuditLogs.length }} / {{ auditLogs.length }} 条记录</span>
            </div>
            <div class="table-list" aria-label="审计日志列表">
              <div v-for="entry in filteredAuditLogs" :key="entry.id" class="table-row audit-row">
                <strong>{{ entry.action }}</strong>
                <span>{{ entry.targetType }}</span>
                <span>{{ entry.targetId ?? '无目标' }}</span>
                <span>{{ metadataSummary(entry) }}</span>
                <span>{{ formatDate(entry.createdAt) }}</span>
              </div>
              <div v-if="filteredAuditLogs.length === 0" class="empty-state">
                没有匹配的审计日志
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  </main>
</template>

<style scoped>
.admin-shell {
  height: 100vh;
  display: grid;
  grid-template-columns: 224px minmax(0, 1fr);
  overflow: hidden;
  background: #f6f7f9;
  color: #1f2328;
  font-family: Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.admin-sidebar {
  min-height: 0;
  overflow-y: auto;
  background: #fff;
  border-right: 1px solid #e4e7ec;
  padding: 24px 18px;
}

.brand {
  font-weight: 700;
  font-size: 18px;
}

.nav-list {
  margin-top: 24px;
  display: grid;
  gap: 8px;
}

.nav-list a {
  color: #3d4656;
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
  padding: 8px 10px;
  border-radius: 6px;
  text-align: left;
  text-decoration: none;
}

.nav-list a:hover,
.nav-list a.active {
  background: #f0f3f8;
  color: #1f2328;
}

.nav-list a.active {
  font-weight: 700;
}

.admin-content {
  min-height: 0;
  overflow-y: auto;
  padding: 40px;
}

.dashboard-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.dashboard-actions {
  display: flex;
  gap: 8px;
}

.page-heading p {
  margin: 0 0 6px;
  color: #667085;
  font-size: 13px;
}

.page-heading h1 {
  margin: 0;
  font-size: 28px;
}

.install-form {
  margin-top: 28px;
  max-width: 520px;
  display: grid;
  gap: 14px;
}

.install-form label {
  display: grid;
  gap: 6px;
  font-size: 14px;
  color: #3d4656;
}

.install-form input {
  height: 38px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  padding: 0 10px;
  font-size: 14px;
  background: #fff;
}

.form-section-title {
  margin-top: 10px;
  font-weight: 700;
}

.install-form button,
.panel button {
  width: fit-content;
  height: 36px;
  border: 0;
  border-radius: 6px;
  padding: 0 14px;
  background: #2563eb;
  color: #fff;
  font-weight: 600;
}

.install-form button:disabled,
.panel button:disabled {
  opacity: 0.48;
}

.error {
  color: #c2410c;
}

.summary-grid {
  margin-top: 24px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.summary-card {
  display: grid;
  gap: 4px;
  padding: 16px;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  background: #fff;
}

.summary-card span,
.summary-card small {
  color: #667085;
  font-size: 13px;
}

.summary-card strong {
  color: #1f2328;
  font-size: 20px;
}

.panel-grid {
  margin-top: 28px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.panel {
  background: #fff;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  padding: 20px;
}

.wide-panel {
  grid-column: 1 / -1;
}

.panel h2 {
  margin: 0 0 8px;
  font-size: 18px;
}

.panel p {
  color: #667085;
  line-height: 1.6;
}

.panel-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
}

.panel-toolbar select {
  min-width: 128px;
  height: 40px;
  border: 1px solid #d0d5dd;
  border-radius: 8px;
  padding: 0 10px;
  background: #fff;
  color: #1f2328;
}

.panel-toolbar span {
  color: #667085;
  font-size: 13px;
  white-space: nowrap;
}

.organization-form,
.user-form {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.organization-form input,
.user-form input,
.user-form select {
  min-width: 0;
  height: 36px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  padding: 0 10px;
  background: #fff;
}

.organization-form button,
.user-form button {
  grid-column: 1 / -1;
}

.table-list {
  margin-top: 16px;
  display: grid;
  gap: 8px;
}

.table-row {
  display: grid;
  grid-template-columns: 1fr 0.8fr 1.2fr 0.7fr;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border: 1px solid #edf0f4;
  border-radius: 6px;
  background: #fbfcfe;
  font-size: 13px;
}

.table-row span {
  color: #667085;
  overflow-wrap: anywhere;
}

.user-row {
  display: grid;
  gap: 10px;
  padding: 10px;
  border: 1px solid #edf0f4;
  border-radius: 6px;
  background: #fbfcfe;
}

.user-row-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.user-row-header div:first-child {
  display: grid;
  gap: 3px;
}

.user-row-header span {
  color: #667085;
  font-size: 13px;
}

.user-badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.user-badges span,
.status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  border-radius: 999px;
  padding: 0 8px;
  background: #edf0f4;
  color: #3d4656;
  font-size: 12px;
}

.status-pill.active {
  background: #e8f7ee;
  color: #17663a;
}

.status-pill.disabled {
  background: #feeceb;
  color: #b42318;
}

.user-edit-form,
.password-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.user-edit-form button,
.password-form button {
  width: fit-content;
}

.checkbox-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #3d4656;
  font-size: 13px;
}

.checkbox-row input {
  width: 16px;
  height: 16px;
}

.audit-row {
  grid-template-columns: 1fr 0.7fr 1fr 1.4fr 1.2fr;
}

.organization-row {
  grid-template-columns: 1fr 0.8fr 0.7fr 1.3fr;
}

.empty-state {
  padding: 16px;
  border: 1px dashed #d0d5dd;
  border-radius: 8px;
  color: #667085;
  text-align: center;
}

@media (max-width: 900px) {
  .admin-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .admin-sidebar {
    border-right: 0;
    border-bottom: 1px solid #e4e7ec;
  }

  .dashboard-header,
  .user-row-header {
    flex-direction: column;
  }

  .dashboard-actions {
    flex-wrap: wrap;
  }

  .summary-grid,
  .panel-grid,
  .organization-form,
  .user-form,
  .user-edit-form,
  .password-form,
  .panel-toolbar {
    grid-template-columns: 1fr;
  }
}
</style>

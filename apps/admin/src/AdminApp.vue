<script setup lang="ts">
import type { AuditLog, EnterpriseUser, Organization, UserRole } from '@muon/enterprise-contracts'
import { Button } from '@muon/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@muon/ui/card'
import { Input } from '@muon/ui/input'
import { Label } from '@muon/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@muon/ui/select'
import { computed, reactive, ref } from 'vue'
import { createAdminUser, createOrganization, installMuon, listAuditLogs, listOrganizations, listUsers, loginAdmin, resetAdminUserPassword, updateAdminUser } from './api'

const props = withDefaults(defineProps<{
  initialInstalled?: boolean
  initialAdminToken?: string
}>(), {
  initialInstalled: false,
  initialAdminToken: '',
})

const adminTokenStorageKey = 'muon_admin_token'

function readStoredAdminToken(): string {
  if (typeof window === 'undefined')
    return ''
  return window.localStorage.getItem(adminTokenStorageKey) ?? ''
}

const installed = ref(props.initialInstalled)
const adminToken = ref(props.initialAdminToken || readStoredAdminToken())
const submitting = ref(false)
const loginSubmitting = ref(false)
const organizationSubmitting = ref(false)
const userSubmitting = ref(false)
const error = ref('')
const loginError = ref('')
const organizationError = ref('')
const userError = ref('')
const organizations = ref<Organization[]>([])
const users = ref<EnterpriseUser[]>([])
const auditLogs = ref<AuditLog[]>([])
const userDrafts = reactive<Record<string, {
  displayName: string
  email: string
  role: UserRole
  username: string
}>>({})
const passwordDrafts = reactive<Record<string, string>>({})
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

function persistAdminToken(token: string) {
  adminToken.value = token
  if (typeof window !== 'undefined')
    window.localStorage.setItem(adminTokenStorageKey, token)
}

function clearAdminToken() {
  adminToken.value = ''
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
  }
}

function canUpdateUser(user: EnterpriseUser) {
  const draft = userDrafts[user.id]
  return Boolean(draft?.username && draft.email && draft.displayName && draft.role)
}

function canResetUserPassword(user: EnterpriseUser) {
  return (passwordDrafts[user.id]?.length ?? 0) >= 12
}

async function refreshDashboard() {
  if (!adminToken.value)
    return

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

async function submitResetUserPassword(user: EnterpriseUser) {
  if (!adminToken.value || !canResetUserPassword(user) || resettingPasswords[user.id])
    return

  resettingPasswords[user.id] = true
  userError.value = ''
  try {
    await resetAdminUserPassword(adminToken.value, user.id, {
      newPassword: passwordDrafts[user.id],
      mustChangePassword: false,
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

if (adminToken.value)
  void refreshDashboard()
</script>

<template>
  <main class="admin-shell">
    <aside class="admin-sidebar">
      <div class="brand">
        Muon Admin
      </div>
      <nav v-if="installed" class="nav-list" aria-label="管理导航">
        <a href="#organizations">组织管理</a>
        <a href="#users">用户管理</a>
        <a href="#audit">审计日志</a>
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
      <div class="page-heading">
        <p>组织后台</p>
        <h1>组织、用户与安全</h1>
      </div>

      <div class="panel-grid">
        <Card id="organizations" class="wide-panel">
          <CardHeader>
            <CardTitle>组织管理</CardTitle>
            <CardDescription>创建新的组织，并为新组织设置独立 owner 账号。</CardDescription>
          </CardHeader>
          <CardContent>
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
              <div v-for="organization in organizations" :key="organization.id" class="table-row organization-row">
                <strong>{{ organization.name }}</strong>
                <span>{{ organization.slug }}</span>
                <span>{{ organization.status }}</span>
                <span>{{ new Date(organization.createdAt).toLocaleString() }}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="users">
          <CardHeader>
            <CardTitle>用户管理</CardTitle>
            <CardDescription>创建成员、设置初始密码、调整角色与停用账号。</CardDescription>
          </CardHeader>
          <CardContent>
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
              <div v-for="user in users" :key="user.id" class="user-row">
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
                </form>
                <form class="password-form" :data-testid="`reset-password-${user.id}`" @submit.prevent="submitResetUserPassword(user)">
                  <Input v-model="passwordDrafts[user.id]" type="password" placeholder="新密码，至少 12 位" autocomplete="new-password" />
                  <Button type="submit" :disabled="!canResetUserPassword(user) || resettingPasswords[user.id]">
                    {{ resettingPasswords[user.id] ? '正在重置' : '重置密码' }}
                  </Button>
                </form>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="audit">
          <CardHeader>
            <CardTitle>审计日志</CardTitle>
            <CardDescription>查看安装、登录、创建用户、重置密码、角色变更和 Matrix provision 记录。</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="table-list" aria-label="审计日志列表">
              <div v-for="entry in auditLogs" :key="entry.id" class="table-row audit-row">
                <strong>{{ entry.action }}</strong>
                <span>{{ entry.targetType }}</span>
                <span>{{ new Date(entry.createdAt).toLocaleString() }}</span>
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
  min-height: 100vh;
  display: grid;
  grid-template-columns: 224px minmax(0, 1fr);
  background: #f6f7f9;
  color: #1f2328;
  font-family: Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.admin-sidebar {
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
  text-decoration: none;
  padding: 8px 10px;
  border-radius: 6px;
}

.nav-list a:hover {
  background: #f0f3f8;
}

.admin-content {
  padding: 40px;
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
  gap: 8px;
  padding: 10px;
  border: 1px solid #edf0f4;
  border-radius: 6px;
  background: #fbfcfe;
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

.audit-row {
  grid-template-columns: 1fr 0.8fr 1.4fr;
}

.organization-row {
  grid-template-columns: 1fr 0.8fr 0.7fr 1.3fr;
}
</style>

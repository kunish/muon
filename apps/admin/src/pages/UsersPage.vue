<script setup lang="ts">
import type { EnterpriseUser, UserRole, UserStatus } from '@muon/enterprise-contracts';
import { Button } from '@muon/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@muon/ui/card';
import { Input } from '@muon/ui/input';
import { computed, reactive, ref, watch } from 'vue';
import { roleLabel, statusLabel } from '@/lib/labels';
import { useCreateUser, useResetUserPassword, useUpdateUser, useUsers } from '@/queries/useUsers';
import UserSessions from './UserSessions.vue';

const { data: users, error: queryError } = useUsers();
const createUser = useCreateUser();
const updateUser = useUpdateUser();
const resetPassword = useResetUserPassword();

const userSearch = ref('');
const userStatusFilter = ref<'all' | UserStatus>('all');

const userForm = reactive({
  username: '',
  email: '',
  displayName: '',
  initialPassword: '',
  role: 'member' as UserRole,
});

interface UserDraft {
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
}

// 页面本地草稿态：编辑表单、密码、是否要求改密。query 刷新后只补齐缺失 key，绝不覆盖正在编辑的字段。
const userDrafts = reactive<Record<string, UserDraft>>({});
const passwordDrafts = reactive<Record<string, string>>({});
const passwordPolicies = reactive<Record<string, boolean>>({});

const userList = computed<EnterpriseUser[]>(() => users.value ?? []);

const filteredUsers = computed(() => {
  const query = userSearch.value.trim().toLowerCase();
  return userList.value.filter((user) => {
    if (userStatusFilter.value !== 'all' && user.status !== userStatusFilter.value) return false;
    if (!query) return true;
    return [
      user.username,
      user.email,
      user.displayName,
      user.status,
      statusLabel(user.status),
      user.roles.join(' '),
      user.roles.map(roleLabel).join(' '),
    ].some((value) => value.toLowerCase().includes(query));
  });
});

const userError = computed(() => {
  const err = createUser.error.value ?? updateUser.error.value ?? resetPassword.error.value ?? queryError.value;
  return err instanceof Error ? err.message : '';
});

const canCreateUser = computed(() => {
  return Boolean(userForm.username && userForm.email && userForm.displayName && userForm.initialPassword.length >= 12);
});

// 只为缺失的用户初始化草稿，保留用户正在编辑的内容；同时清理已删除用户的草稿。
function syncUserDrafts(nextUsers: EnterpriseUser[]) {
  const ids = new Set(nextUsers.map((user) => user.id));
  for (const user of nextUsers) {
    if (userDrafts[user.id]) continue;
    userDrafts[user.id] = {
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.roles[0] ?? 'member',
    };
    passwordDrafts[user.id] = '';
    passwordPolicies[user.id] = false;
  }
  for (const id of Object.keys(userDrafts)) {
    if (ids.has(id)) continue;
    delete userDrafts[id];
    delete passwordDrafts[id];
    delete passwordPolicies[id];
  }
}

watch(users, (nextUsers) => syncUserDrafts(nextUsers ?? []), { immediate: true });

function canUpdateUser(userId: string) {
  const draft = userDrafts[userId];
  return Boolean(draft?.username && draft.email && draft.displayName && draft.role);
}

function canResetUserPassword(userId: string) {
  return (passwordDrafts[userId]?.length ?? 0) >= 12;
}

async function submitCreateUser() {
  if (!canCreateUser.value || createUser.isPending.value) return;
  try {
    await createUser.mutateAsync({
      username: userForm.username,
      email: userForm.email,
      displayName: userForm.displayName,
      initialPassword: userForm.initialPassword,
      roles: [userForm.role],
    });
    userForm.username = '';
    userForm.email = '';
    userForm.displayName = '';
    userForm.initialPassword = '';
    userForm.role = 'member';
  } catch {
    // 错误通过 userError 计算属性展示；401 已在 mutation onError 收口。
  }
}

async function submitUpdateUser(user: EnterpriseUser) {
  const draft = userDrafts[user.id];
  if (!draft || !canUpdateUser(user.id) || updateUser.isPending.value) return;
  try {
    await updateUser.mutateAsync({
      userId: user.id,
      patch: {
        username: draft.username,
        email: draft.email,
        displayName: draft.displayName,
        roles: [draft.role],
      },
    });
  } catch {
    // 错误通过 userError 计算属性展示。
  }
}

async function toggleUserStatus(user: EnterpriseUser) {
  if (updateUser.isPending.value) return;
  try {
    await updateUser.mutateAsync({
      userId: user.id,
      patch: { status: user.status === 'active' ? 'disabled' : 'active' },
    });
  } catch {
    // 错误通过 userError 计算属性展示。
  }
}

async function submitResetUserPassword(user: EnterpriseUser) {
  if (!canResetUserPassword(user.id) || resetPassword.isPending.value) return;
  try {
    await resetPassword.mutateAsync({
      userId: user.id,
      payload: {
        newPassword: passwordDrafts[user.id],
        mustChangePassword: passwordPolicies[user.id] ?? false,
      },
    });
    passwordDrafts[user.id] = '';
  } catch {
    // 错误通过 userError 计算属性展示。
  }
}
</script>

<template>
  <section class="admin-content" data-testid="users-page">
    <div class="page-heading">
      <p>组织后台</p>
      <h1>用户管理</h1>
    </div>

    <Card id="users" class="wide-panel" data-testid="users-panel">
      <CardHeader>
        <CardTitle>用户管理</CardTitle>
        <CardDescription>创建成员、设置初始密码、调整角色与停用账号。</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="panel-toolbar">
          <Input
            v-model="userSearch"
            data-testid="user-search"
            placeholder="搜索用户名、邮箱、显示名称或角色"
            autocomplete="off"
          />
          <select v-model="userStatusFilter" data-testid="user-status-filter" aria-label="用户状态筛选">
            <option value="all">全部状态</option>
            <option value="active">正常</option>
            <option value="disabled">已停用</option>
          </select>
          <span>{{ filteredUsers.length }} / {{ userList.length }} 个用户</span>
        </div>
        <form class="user-form" data-testid="user-form" @submit.prevent="submitCreateUser">
          <Input v-model="userForm.username" placeholder="用户名" autocomplete="off" />
          <Input v-model="userForm.email" placeholder="邮箱" autocomplete="off" />
          <Input v-model="userForm.displayName" placeholder="显示名称" autocomplete="off" />
          <Input
            v-model="userForm.initialPassword"
            type="password"
            placeholder="初始密码，至少 12 位"
            autocomplete="new-password"
          />
          <select v-model="userForm.role" data-testid="user-role" aria-label="角色">
            <option value="member">成员</option>
            <option value="admin">管理员</option>
            <option value="owner">Owner</option>
          </select>
          <Button class="w-fit" type="submit" :disabled="!canCreateUser || createUser.isPending.value">
            {{ createUser.isPending.value ? '正在创建' : '新建用户' }}
          </Button>
        </form>
        <p v-if="userError" class="error" data-testid="user-error">
          {{ userError }}
        </p>
        <div class="table-list" aria-label="用户列表">
          <div v-for="user in filteredUsers" :key="user.id" class="user-row" :data-testid="`user-row-${user.id}`">
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
            <form
              v-if="userDrafts[user.id]"
              class="user-edit-form"
              :data-testid="`edit-user-${user.id}`"
              @submit.prevent="submitUpdateUser(user)"
            >
              <Input v-model="userDrafts[user.id].username" placeholder="编辑用户名" autocomplete="off" />
              <Input v-model="userDrafts[user.id].email" placeholder="编辑邮箱" autocomplete="off" />
              <Input v-model="userDrafts[user.id].displayName" placeholder="编辑显示名称" autocomplete="off" />
              <select
                v-model="userDrafts[user.id].role"
                :data-testid="`edit-user-role-${user.id}`"
                aria-label="编辑角色"
              >
                <option value="member">成员</option>
                <option value="admin">管理员</option>
                <option value="owner">Owner</option>
              </select>
              <Button type="submit" :disabled="!canUpdateUser(user.id) || updateUser.isPending.value">
                {{ updateUser.isPending.value ? '正在保存' : '保存用户' }}
              </Button>
              <Button
                :data-testid="`toggle-user-status-${user.id}`"
                type="button"
                variant="outline"
                :disabled="updateUser.isPending.value"
                @click="toggleUserStatus(user)"
              >
                {{ user.status === 'active' ? '停用用户' : '启用用户' }}
              </Button>
            </form>
            <form
              class="password-form"
              :data-testid="`reset-password-${user.id}`"
              @submit.prevent="submitResetUserPassword(user)"
            >
              <Input
                v-model="passwordDrafts[user.id]"
                type="password"
                placeholder="新密码，至少 12 位"
                autocomplete="new-password"
              />
              <label class="checkbox-row">
                <input
                  v-model="passwordPolicies[user.id]"
                  :data-testid="`must-change-password-${user.id}`"
                  type="checkbox"
                />
                下次登录必须修改密码
              </label>
              <Button type="submit" :disabled="!canResetUserPassword(user.id) || resetPassword.isPending.value">
                {{ resetPassword.isPending.value ? '正在重置' : '重置密码' }}
              </Button>
            </form>
            <UserSessions :user-id="user.id" />
          </div>
          <div v-if="filteredUsers.length === 0" class="empty-state">没有匹配的用户</div>
        </div>
      </CardContent>
    </Card>
  </section>
</template>

<style scoped>
.admin-content {
  min-height: 0;
  overflow-y: auto;
  padding: 40px;
}

.page-heading p {
  margin: 0 0 6px;
  color: #667085;
  font-size: 13px;
}

.page-heading h1 {
  margin: 0 0 24px;
  font-size: 28px;
}

.error {
  color: #c2410c;
}

.wide-panel {
  grid-column: 1 / -1;
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

.user-form {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.user-form input,
.user-form select {
  min-width: 0;
  height: 36px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  padding: 0 10px;
  background: #fff;
}

.user-form button {
  grid-column: 1 / -1;
}

.table-list {
  margin-top: 16px;
  display: grid;
  gap: 8px;
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

.user-edit-form select {
  min-width: 0;
  height: 36px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  padding: 0 10px;
  background: #fff;
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

.empty-state {
  padding: 16px;
  border: 1px dashed #d0d5dd;
  border-radius: 8px;
  color: #667085;
  text-align: center;
}

@media (max-width: 900px) {
  .panel-toolbar,
  .user-form,
  .user-edit-form,
  .password-form,
  .user-row-header {
    grid-template-columns: 1fr;
  }
}
</style>

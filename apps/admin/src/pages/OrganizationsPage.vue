<script setup lang="ts">
import type { Organization } from '@muon/enterprise-contracts';
import { Button } from '@muon/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@muon/ui/card';
import { Input } from '@muon/ui/input';
import { computed, reactive, ref } from 'vue';
import { statusLabel } from '@/lib/labels';
import { useCreateOrganization, useOrganizations } from '@/queries/useOrganizations';

const { data: organizations, error: queryError } = useOrganizations();
const createOrganization = useCreateOrganization();

const organizationSearch = ref('');
const organizationForm = reactive({
  organizationName: '',
  organizationSlug: '',
  ownerUsername: '',
  ownerEmail: '',
  ownerDisplayName: '',
  ownerPassword: '',
});

const organizationList = computed<Organization[]>(() => organizations.value ?? []);

const canCreateOrganization = computed(() => {
  return Boolean(
    organizationForm.organizationName &&
    organizationForm.organizationSlug &&
    organizationForm.ownerUsername &&
    organizationForm.ownerEmail &&
    organizationForm.ownerDisplayName &&
    organizationForm.ownerPassword.length >= 12,
  );
});

const filteredOrganizations = computed(() => {
  const query = organizationSearch.value.trim().toLowerCase();
  if (!query) return organizationList.value;
  return organizationList.value.filter((organization) => {
    return [organization.name, organization.slug, organization.status, statusLabel(organization.status)].some((value) =>
      value.toLowerCase().includes(query),
    );
  });
});

const organizationError = computed(() => {
  const err = createOrganization.error.value ?? queryError.value;
  return err instanceof Error ? err.message : '';
});

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

async function submitCreateOrganization() {
  if (!canCreateOrganization.value || createOrganization.isPending.value) return;
  try {
    await createOrganization.mutateAsync({
      organizationName: organizationForm.organizationName,
      organizationSlug: organizationForm.organizationSlug,
      ownerUsername: organizationForm.ownerUsername,
      ownerEmail: organizationForm.ownerEmail,
      ownerDisplayName: organizationForm.ownerDisplayName,
      ownerPassword: organizationForm.ownerPassword,
    });
    organizationForm.organizationName = '';
    organizationForm.organizationSlug = '';
    organizationForm.ownerUsername = '';
    organizationForm.ownerEmail = '';
    organizationForm.ownerDisplayName = '';
    organizationForm.ownerPassword = '';
  } catch {
    // 错误通过 organizationError 计算属性展示；401 已在 mutation onError 收口。
  }
}
</script>

<template>
  <section class="admin-content" data-testid="organizations-page">
    <div class="page-heading">
      <p>组织后台</p>
      <h1>组织管理</h1>
    </div>

    <Card id="organizations" class="wide-panel" data-testid="organizations-panel">
      <CardHeader>
        <CardTitle>组织管理</CardTitle>
        <CardDescription>创建新的组织，并为新组织设置独立 owner 账号。</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="panel-toolbar">
          <Input
            v-model="organizationSearch"
            data-testid="organization-search"
            placeholder="搜索组织名称、标识或状态"
            autocomplete="off"
          />
          <span>{{ filteredOrganizations.length }} / {{ organizationList.length }} 个组织</span>
        </div>
        <form class="organization-form" @submit.prevent="submitCreateOrganization">
          <Input v-model="organizationForm.organizationName" placeholder="组织名称" autocomplete="off" />
          <Input v-model="organizationForm.organizationSlug" placeholder="组织标识" autocomplete="off" />
          <Input v-model="organizationForm.ownerUsername" placeholder="Owner 用户名" autocomplete="off" />
          <Input v-model="organizationForm.ownerEmail" placeholder="Owner 邮箱" autocomplete="off" />
          <Input v-model="organizationForm.ownerDisplayName" placeholder="Owner 显示名称" autocomplete="off" />
          <Input
            v-model="organizationForm.ownerPassword"
            type="password"
            placeholder="Owner 初始密码，至少 12 位"
            autocomplete="new-password"
          />
          <Button class="w-fit" type="submit" :disabled="!canCreateOrganization || createOrganization.isPending.value">
            {{ createOrganization.isPending.value ? '正在创建' : '新建组织' }}
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
          <div v-if="filteredOrganizations.length === 0" class="empty-state">没有匹配的组织</div>
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
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
}

.panel-toolbar span {
  color: #667085;
  font-size: 13px;
  white-space: nowrap;
}

.organization-form {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.organization-form button {
  grid-column: 1 / -1;
}

.table-list {
  margin-top: 16px;
  display: grid;
  gap: 8px;
}

.table-row {
  display: grid;
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
  .organization-form,
  .panel-toolbar {
    grid-template-columns: 1fr;
  }
}
</style>

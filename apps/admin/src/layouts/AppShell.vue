<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { logoutAdmin } from '@/api';
import { useAuditLogs } from '@/queries/useAuditLogs';
import { useOrganizations } from '@/queries/useOrganizations';
import { useUsers } from '@/queries/useUsers';
import { adminSections } from '@/router';
import { clearToken, sessionStore } from '@/stores/sessionStore';

const route = useRoute();
const router = useRouter();

const activeAdminSection = computed(() => route.meta?.adminSection);

// 顶部概览：复用三个 section 各自的 query（vue-query 共享缓存，不会重复请求）。
const { data: organizations } = useOrganizations();
const { data: users } = useUsers();
const { data: auditLogs } = useAuditLogs();

const organizationCount = computed(() => organizations.value?.length ?? 0);
const userCount = computed(() => users.value?.length ?? 0);
const auditCount = computed(() => auditLogs.value?.length ?? 0);
const activeUsers = computed(() => (users.value ?? []).filter((user) => user.status === 'active').length);
const disabledUsers = computed(() => (users.value ?? []).filter((user) => user.status === 'disabled').length);

async function logout() {
  const token = sessionStore.state.adminToken;
  if (token) {
    try {
      await logoutAdmin(token);
    } catch {
      // Best-effort: server may already have invalidated the token.
    }
  }
  clearToken();
  await router.replace({ name: 'admin-login' });
}
</script>

<template>
  <main class="admin-shell">
    <aside class="admin-sidebar">
      <div class="brand">Muon Admin</div>
      <nav class="nav-list" aria-label="管理导航">
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
      <div class="summary-grid" data-testid="admin-summary" aria-label="后台概览">
        <div class="summary-card" data-testid="summary-organizations">
          <span>组织</span>
          <strong>{{ organizationCount }}</strong>
        </div>
        <div class="summary-card" data-testid="summary-users">
          <span>用户</span>
          <strong>{{ userCount }}</strong>
          <small>{{ activeUsers }} 正常 / {{ disabledUsers }} 停用</small>
        </div>
        <div class="summary-card" data-testid="summary-audit">
          <span>审计</span>
          <strong>{{ auditCount }}</strong>
        </div>
      </div>

      <button type="button" class="logout-button" data-testid="logout-admin" @click="logout">退出登录</button>
    </aside>

    <RouterView />
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
  display: flex;
  flex-direction: column;
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

.summary-grid {
  margin-top: auto;
  display: grid;
  gap: 8px;
  padding-top: 24px;
}

.summary-card {
  display: grid;
  gap: 2px;
  padding: 12px;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  background: #fbfcfe;
}

.summary-card span,
.summary-card small {
  color: #667085;
  font-size: 12px;
}

.summary-card strong {
  color: #1f2328;
  font-size: 20px;
}

.logout-button {
  margin-top: 16px;
  border: 0;
  background: transparent;
  color: #3d4656;
  font: inherit;
  cursor: pointer;
  padding: 8px 10px;
  border-radius: 6px;
  text-align: left;
}

.logout-button:hover {
  background: #f0f3f8;
  color: #1f2328;
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
}
</style>

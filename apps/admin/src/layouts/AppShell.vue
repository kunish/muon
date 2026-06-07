<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { logoutAdmin } from '@/api';
import { adminSections } from '@/router';
import { clearToken, sessionStore } from '@/stores/sessionStore';

const route = useRoute();
const router = useRouter();

const activeAdminSection = computed(() => route.meta?.adminSection);

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

.logout-button {
  margin-top: auto;
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
